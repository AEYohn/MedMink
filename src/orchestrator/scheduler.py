"""Task scheduling for the orchestrator."""

from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

import structlog

from src.config import settings
from src.models import Task, TaskStatus, TaskType
from src.orchestrator.state import OrchestratorState, TaskQueue

logger = structlog.get_logger()


class TaskScheduler:
    """Schedules recurring and triggered tasks."""

    def __init__(self, state: OrchestratorState, queue: TaskQueue):
        self.state = state
        self.queue = queue
        self.logger = logger.bind(component="scheduler")

    async def check_scheduled_tasks(self) -> list[Task]:
        """Check and create scheduled tasks."""
        tasks = []

        # Check daily ingest
        if self._should_run_daily_ingest():
            task = await self._create_ingest_task()
            tasks.append(task)
            self.state.set("last_daily_ingest", datetime.utcnow().isoformat())

        # Check weekly synthesis
        if self._should_run_weekly_synthesis():
            task = await self._create_synthesis_task()
            tasks.append(task)
            self.state.set("last_weekly_synthesis", datetime.utcnow().isoformat())

        # Check for trend analysis (every 3 days)
        if self._should_run_trend_analysis():
            task = await self._create_trend_task()
            tasks.append(task)
            self.state.set("last_trend_analysis", datetime.utcnow().isoformat())

        # Check for prediction generation (weekly)
        if self._should_run_prediction_generation():
            task = await self._create_prediction_task()
            tasks.append(task)
            self.state.set("last_prediction_generation", datetime.utcnow().isoformat())

        # Check for prediction verification (daily)
        if self._should_run_prediction_verification():
            task = await self._create_verification_task()
            tasks.append(task)
            self.state.set("last_prediction_verification", datetime.utcnow().isoformat())

        return tasks

    def _should_run_daily_ingest(self) -> bool:
        """Check if daily ingest should run."""
        last_run = self.state.get("last_daily_ingest")
        if not last_run:
            return True

        last_run_dt = datetime.fromisoformat(last_run)
        now = datetime.utcnow()

        # Run if it's past the scheduled hour and hasn't run today
        if now.hour >= settings.daily_ingest_hour:
            if last_run_dt.date() < now.date():
                return True

        return False

    def _should_run_weekly_synthesis(self) -> bool:
        """Check if weekly synthesis should run."""
        last_run = self.state.get("last_weekly_synthesis")
        if not last_run:
            return True

        last_run_dt = datetime.fromisoformat(last_run)
        now = datetime.utcnow()

        # Run on the scheduled day if it hasn't run this week
        if now.weekday() == settings.weekly_synthesis_day:
            if now.hour >= settings.weekly_synthesis_hour:
                # Check if we've already run this week
                days_since = (now - last_run_dt).days
                if days_since >= 7:
                    return True

        return False

    def _should_run_trend_analysis(self) -> bool:
        """Check if trend analysis should run."""
        last_run = self.state.get("last_trend_analysis")
        if not last_run:
            return True

        last_run_dt = datetime.fromisoformat(last_run)
        days_since = (datetime.utcnow() - last_run_dt).days
        return days_since >= 3

    def _should_run_prediction_generation(self) -> bool:
        """Check if prediction generation should run."""
        last_run = self.state.get("last_prediction_generation")
        if not last_run:
            return True

        last_run_dt = datetime.fromisoformat(last_run)
        days_since = (datetime.utcnow() - last_run_dt).days
        return days_since >= 7

    def _should_run_prediction_verification(self) -> bool:
        """Check if prediction verification should run."""
        last_run = self.state.get("last_prediction_verification")
        if not last_run:
            return True

        last_run_dt = datetime.fromisoformat(last_run)
        days_since = (datetime.utcnow() - last_run_dt).days
        return days_since >= 1

    async def _create_ingest_task(self) -> Task:
        """Create a paper ingestion task."""
        task = Task(
            id=str(uuid4()),
            type=TaskType.INGEST,
            status=TaskStatus.PENDING,
            priority=5,
            payload={
                "topic": "machine learning",
                "categories": settings.arxiv_categories,
                "max_results": settings.arxiv_max_results,
                "days_back": 1,  # Only get papers from last day for daily ingest
            },
        )
        await self.queue.add(task)
        self.logger.info("Scheduled daily ingest task", task_id=task.id)
        return task

    async def _create_synthesis_task(self) -> Task:
        """Create a weekly synthesis task."""
        task = Task(
            id=str(uuid4()),
            type=TaskType.SYNTHESIZE,
            status=TaskStatus.PENDING,
            priority=6,  # Higher priority
            payload={
                "week_start": (datetime.utcnow() - timedelta(days=7)).date().isoformat(),
            },
        )
        await self.queue.add(task)
        self.logger.info("Scheduled weekly synthesis task", task_id=task.id)
        return task

    async def _create_trend_task(self) -> Task:
        """Create a trend analysis task."""
        task = Task(
            id=str(uuid4()),
            type=TaskType.IDENTIFY_TRENDS,
            status=TaskStatus.PENDING,
            priority=4,
            payload={},
        )
        await self.queue.add(task)
        self.logger.info("Scheduled trend analysis task", task_id=task.id)
        return task

    async def _create_prediction_task(self) -> Task:
        """Create a prediction generation task."""
        task = Task(
            id=str(uuid4()),
            type=TaskType.GENERATE_PREDICTIONS,
            status=TaskStatus.PENDING,
            priority=4,
            payload={},
        )
        await self.queue.add(task)
        self.logger.info("Scheduled prediction generation task", task_id=task.id)
        return task

    async def _create_verification_task(self) -> Task:
        """Create a prediction verification task."""
        task = Task(
            id=str(uuid4()),
            type=TaskType.CORRECT,
            status=TaskStatus.PENDING,
            priority=3,
            payload={"action": "verify_predictions"},
        )
        await self.queue.add(task)
        self.logger.info("Scheduled prediction verification task", task_id=task.id)
        return task

    async def create_manual_task(
        self,
        task_type: TaskType,
        payload: dict[str, Any] | None = None,
        priority: int = 5,
    ) -> Task:
        """Create a manual task."""
        task = Task(
            id=str(uuid4()),
            type=task_type,
            status=TaskStatus.PENDING,
            priority=priority,
            payload=payload or {},
        )
        await self.queue.add(task)
        self.logger.info("Created manual task", task_id=task.id, type=task_type)
        return task

    async def create_correction_task(
        self,
        error: str,
        failed_task_id: str,
        failed_task_type: str,
        context: dict[str, Any],
    ) -> Task:
        """Create a correction task for a failed task."""
        task = Task(
            id=str(uuid4()),
            type=TaskType.CORRECT,
            status=TaskStatus.PENDING,
            priority=8,  # High priority for corrections
            payload={
                "error": error,
                "failed_task_id": failed_task_id,
                "failed_task_type": failed_task_type,
                "context": context,
            },
        )
        await self.queue.add(task)
        self.logger.info(
            "Created correction task",
            task_id=task.id,
            failed_task_id=failed_task_id,
        )
        return task

    async def create_analysis_task(self, paper_id: str | None = None, batch_size: int = 10) -> Task:
        """Create a paper analysis task."""
        task = Task(
            id=str(uuid4()),
            type=TaskType.ANALYZE,
            status=TaskStatus.PENDING,
            priority=5,
            payload={
                "paper_id": paper_id,
                "batch_size": batch_size,
            },
        )
        await self.queue.add(task)
        self.logger.info("Created analysis task", task_id=task.id)
        return task

    async def create_contradiction_task(self, limit: int = 50) -> Task:
        """Create a contradiction detection task."""
        task = Task(
            id=str(uuid4()),
            type=TaskType.DETECT_CONTRADICTIONS,
            status=TaskStatus.PENDING,
            priority=4,
            payload={"limit": limit},
        )
        await self.queue.add(task)
        self.logger.info("Created contradiction detection task", task_id=task.id)
        return task
