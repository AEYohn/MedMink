"""Main orchestrator loop."""

import asyncio
import signal
from datetime import datetime
from typing import Any

import structlog

from src.agents import IngestAgent, AnalyzeAgent, SynthesizeAgent, CorrectionAgent, ProjectAnalyzerAgent, PatternAgent
from src.config import settings
from src.db import init_databases, close_databases
from src.kg import get_knowledge_graph
from src.models import Task, TaskType
from src.orchestrator.scheduler import TaskScheduler
from src.orchestrator.state import OrchestratorState, TaskQueue, ThoughtSignatureStore

logger = structlog.get_logger()


class Orchestrator:
    """Main orchestrator for the research synthesizer."""

    def __init__(self):
        self.state = OrchestratorState()
        self.queue = TaskQueue()
        self.scheduler = TaskScheduler(self.state, self.queue)
        self.thought_store = ThoughtSignatureStore()
        self.running = False
        self._shutdown_event = asyncio.Event()

        # Initialize agents
        self.agents = {
            TaskType.INGEST: IngestAgent(),
            TaskType.ANALYZE: AnalyzeAgent(),
            TaskType.SYNTHESIZE: SynthesizeAgent(),
            TaskType.CORRECT: CorrectionAgent(),
            TaskType.DETECT_CONTRADICTIONS: AnalyzeAgent(),
            TaskType.IDENTIFY_TRENDS: AnalyzeAgent(),
            TaskType.GENERATE_PREDICTIONS: AnalyzeAgent(),
            TaskType.PROJECT_ANALYZE: ProjectAnalyzerAgent(),
            TaskType.CUSTOM: PatternAgent(),
        }

        self.logger = logger.bind(component="orchestrator")

    async def start(self) -> None:
        """Start the orchestrator."""
        self.logger.info("Starting orchestrator")

        # Initialize databases
        await init_databases()

        # Initialize knowledge graph
        await get_knowledge_graph()

        # Load state
        await self.state.load()

        self.running = True
        self.logger.info("Orchestrator started")

    async def stop(self) -> None:
        """Stop the orchestrator."""
        self.logger.info("Stopping orchestrator")
        self.running = False
        self._shutdown_event.set()

        # Save final state
        await self.state.save()

        # Close databases
        await close_databases()

        self.logger.info("Orchestrator stopped")

    async def run(self) -> None:
        """Main orchestrator loop."""
        await self.start()

        try:
            while self.running:
                try:
                    # Check for scheduled tasks
                    scheduled = await self.scheduler.check_scheduled_tasks()
                    if scheduled:
                        self.logger.info("Scheduled tasks created", count=len(scheduled))

                    # Process pending tasks
                    task = await self.queue.get_next()

                    if task:
                        await self._execute_task(task)
                    else:
                        # No tasks, wait a bit
                        await asyncio.sleep(settings.orchestrator_poll_interval)

                    # Update heartbeat
                    await self.state.heartbeat()

                    # Check for shutdown
                    if self._shutdown_event.is_set():
                        break

                except asyncio.CancelledError:
                    break
                except Exception as e:
                    self.logger.error("Error in main loop", error=str(e))
                    self.state.increment("errors_today")
                    await asyncio.sleep(5)  # Back off on error

        finally:
            await self.stop()

    async def _execute_task(self, task: Task) -> None:
        """Execute a single task."""
        self.logger.info(
            "Executing task",
            task_id=task.id,
            type=task.type,
            priority=task.priority,
        )

        start_time = datetime.utcnow()

        try:
            # Get the appropriate agent
            agent = self._get_agent_for_task(task)

            if not agent:
                self.logger.error("No agent for task type", type=task.type)
                await self.queue.fail(task.id, f"No agent for task type: {task.type}")
                return

            # Execute the task
            result = await agent.execute(task)

            # Save thought signature if present
            if result.thought_signature:
                await self.thought_store.save(result.thought_signature)

            if result.success:
                await self.queue.complete(task.id, result.to_dict())
                self.state.increment("total_tasks_executed")

                # Create follow-up tasks if needed
                await self._handle_follow_up(task, result)
            else:
                await self.queue.fail(task.id, result.error or "Unknown error")

                # Create correction task
                if task.type != TaskType.CORRECT:
                    await self.scheduler.create_correction_task(
                        error=result.error or "Unknown error",
                        failed_task_id=task.id,
                        failed_task_type=task.type.value,
                        context=task.payload,
                    )

            duration = (datetime.utcnow() - start_time).total_seconds()
            self.logger.info(
                "Task execution complete",
                task_id=task.id,
                success=result.success,
                duration_seconds=duration,
            )

        except Exception as e:
            self.logger.error(
                "Task execution failed",
                task_id=task.id,
                error=str(e),
            )
            await self.queue.fail(task.id, str(e))
            self.state.increment("errors_today")

    def _get_agent_for_task(self, task: Task):
        """Get the appropriate agent for a task."""
        return self.agents.get(task.type)

    async def _handle_follow_up(self, task: Task, result) -> None:
        """Handle follow-up tasks after successful execution."""
        # After ingestion, create analysis tasks
        if task.type == TaskType.INGEST:
            papers_ingested = result.data.get("papers_ingested", 0)
            if papers_ingested > 0:
                await self.scheduler.create_analysis_task(batch_size=min(papers_ingested, 10))

        # After analysis, check for contradictions
        elif task.type == TaskType.ANALYZE:
            claims_extracted = result.metrics.get("claims_extracted", 0)
            if claims_extracted > 0:
                await self.scheduler.create_contradiction_task()

        # After correction, potentially create new task
        elif task.type == TaskType.CORRECT:
            new_task = result.data.get("new_task")
            if new_task:
                await self.scheduler.create_manual_task(
                    task_type=TaskType(new_task["type"]),
                    payload=new_task.get("payload"),
                    priority=new_task.get("priority", 5),
                )

    async def get_status(self) -> dict[str, Any]:
        """Get orchestrator status."""
        queue_stats = await self.queue.get_stats()

        return {
            "running": self.running,
            "state": {
                "total_tasks_executed": self.state.get("total_tasks_executed", 0),
                "errors_today": self.state.get("errors_today", 0),
                "last_daily_ingest": self.state.get("last_daily_ingest"),
                "last_weekly_synthesis": self.state.get("last_weekly_synthesis"),
            },
            "queue": queue_stats,
        }


async def run_orchestrator():
    """Run the orchestrator as a standalone process."""
    orchestrator = Orchestrator()

    # Set up signal handlers
    loop = asyncio.get_event_loop()

    def signal_handler():
        logger.info("Received shutdown signal")
        asyncio.create_task(orchestrator.stop())

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, signal_handler)

    try:
        await orchestrator.run()
    except Exception as e:
        logger.error("Orchestrator crashed", error=str(e))
        raise


if __name__ == "__main__":
    # Configure logging
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    asyncio.run(run_orchestrator())
