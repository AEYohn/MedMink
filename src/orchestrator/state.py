"""State persistence for the orchestrator."""

import json
from datetime import date, datetime
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import AsyncSessionLocal
from src.models import Task, TaskStatus, TaskType, ThoughtSignature

logger = structlog.get_logger()


class DateTimeEncoder(json.JSONEncoder):
    """JSON encoder that handles datetime objects."""

    def default(self, obj):
        if isinstance(obj, datetime | date):
            return obj.isoformat()
        return super().default(obj)


def json_dumps(obj: Any) -> str:
    """JSON dumps with datetime support."""
    return json.dumps(obj, cls=DateTimeEncoder)


class OrchestratorState:
    """Manages orchestrator state persistence."""

    def __init__(self, state_id: str = "main"):
        self.state_id = state_id
        self._state: dict[str, Any] = {}
        self._loaded = False

    async def load(self) -> dict[str, Any]:
        """Load state from database."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT state FROM orchestrator_state WHERE id = :id"),
                {"id": self.state_id},
            )
            row = result.fetchone()

            if row:
                self._state = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            else:
                # Initialize state
                self._state = {
                    "last_daily_ingest": None,
                    "last_weekly_synthesis": None,
                    "total_tasks_executed": 0,
                    "errors_today": 0,
                    "started_at": datetime.utcnow().isoformat(),
                }
                await self._create_initial_state(session)

            self._loaded = True
            logger.info("Orchestrator state loaded", state_id=self.state_id)
            return self._state

    async def _create_initial_state(self, session: AsyncSession) -> None:
        """Create initial state record."""
        await session.execute(
            text("""
                INSERT INTO orchestrator_state (id, state, last_heartbeat)
                VALUES (:id, :state, NOW())
                ON CONFLICT (id) DO UPDATE SET state = :state
            """),
            {"id": self.state_id, "state": json_dumps(self._state)},
        )
        await session.commit()

    async def save(self) -> None:
        """Save state to database."""
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("""
                    UPDATE orchestrator_state
                    SET state = :state, last_heartbeat = NOW()
                    WHERE id = :id
                """),
                {"id": self.state_id, "state": json_dumps(self._state)},
            )
            await session.commit()
        logger.debug("Orchestrator state saved")

    async def heartbeat(self) -> None:
        """Update heartbeat timestamp."""
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("""
                    UPDATE orchestrator_state
                    SET last_heartbeat = NOW()
                    WHERE id = :id
                """),
                {"id": self.state_id},
            )
            await session.commit()

    def get(self, key: str, default: Any = None) -> Any:
        """Get a state value."""
        return self._state.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Set a state value."""
        self._state[key] = value

    def increment(self, key: str, amount: int = 1) -> int:
        """Increment a counter."""
        current = self._state.get(key, 0)
        self._state[key] = current + amount
        return self._state[key]


class TaskQueue:
    """Task queue with priority scheduling."""

    async def add(self, task: Task) -> str:
        """Add a task to the queue."""
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("""
                    INSERT INTO tasks (id, type, status, priority, payload, created_at)
                    VALUES (:id, :type, :status, :priority, :payload, NOW())
                """),
                {
                    "id": task.id,
                    "type": task.type.value,
                    "status": task.status.value,
                    "priority": task.priority,
                    "payload": json_dumps(task.payload),
                },
            )
            await session.commit()

        logger.info("Task added to queue", task_id=task.id, type=task.type)
        return task.id

    async def get_next(self) -> Task | None:
        """Get the next task to execute (highest priority, oldest first)."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("""
                    SELECT id, type, status, priority, payload, created_at, retry_count
                    FROM tasks
                    WHERE status = 'pending'
                    ORDER BY priority DESC, created_at ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                """)
            )
            row = result.fetchone()

            if not row:
                return None

            # Mark as in progress
            await session.execute(
                text("""
                    UPDATE tasks
                    SET status = 'in_progress', started_at = NOW()
                    WHERE id = :id
                """),
                {"id": row[0]},
            )
            await session.commit()

            return Task(
                id=str(row[0]),
                type=TaskType(row[1]),
                status=TaskStatus.IN_PROGRESS,
                priority=row[3],
                payload=row[4] if isinstance(row[4], dict) else json.loads(row[4]) if row[4] else {},
                created_at=row[5],
                retry_count=row[6],
            )

    async def complete(self, task_id: str, result: dict[str, Any]) -> None:
        """Mark a task as completed."""
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("""
                    UPDATE tasks
                    SET status = 'completed', result = :result, completed_at = NOW()
                    WHERE id = :id
                """),
                {"id": task_id, "result": json_dumps(result)},
            )
            await session.commit()

        logger.info("Task completed", task_id=task_id)

    async def fail(self, task_id: str, error: str, retry: bool = True) -> None:
        """Mark a task as failed."""
        async with AsyncSessionLocal() as session:
            if retry:
                # Check retry count
                result = await session.execute(
                    text("SELECT retry_count FROM tasks WHERE id = :id"),
                    {"id": task_id},
                )
                row = result.fetchone()
                retry_count = row[0] if row else 0

                if retry_count < 3:
                    # Re-queue the task
                    await session.execute(
                        text("""
                            UPDATE tasks
                            SET status = 'pending', error = :error, retry_count = retry_count + 1
                            WHERE id = :id
                        """),
                        {"id": task_id, "error": error},
                    )
                    logger.info("Task re-queued for retry", task_id=task_id, retry_count=retry_count + 1)
                else:
                    # Max retries reached
                    await session.execute(
                        text("""
                            UPDATE tasks
                            SET status = 'failed', error = :error, completed_at = NOW()
                            WHERE id = :id
                        """),
                        {"id": task_id, "error": error},
                    )
                    logger.warning("Task failed after max retries", task_id=task_id)
            else:
                await session.execute(
                    text("""
                        UPDATE tasks
                        SET status = 'failed', error = :error, completed_at = NOW()
                        WHERE id = :id
                    """),
                    {"id": task_id, "error": error},
                )
                logger.warning("Task failed", task_id=task_id)

            await session.commit()

    async def get_pending_count(self) -> int:
        """Get count of pending tasks."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM tasks WHERE status = 'pending'")
            )
            return result.scalar() or 0

    async def get_in_progress_count(self) -> int:
        """Get count of in-progress tasks."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'")
            )
            return result.scalar() or 0

    async def get_stats(self) -> dict[str, Any]:
        """Get task queue statistics."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("""
                    SELECT
                        status,
                        COUNT(*) as count
                    FROM tasks
                    WHERE created_at > NOW() - INTERVAL '24 hours'
                    GROUP BY status
                """)
            )
            rows = result.fetchall()

            stats = {"pending": 0, "in_progress": 0, "completed": 0, "failed": 0}
            for row in rows:
                stats[row[0]] = row[1]

            return stats


class ThoughtSignatureStore:
    """Store for thought signatures."""

    async def save(self, signature: ThoughtSignature) -> str:
        """Save a thought signature."""
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("""
                    INSERT INTO thought_signatures
                    (id, agent_name, task_id, context_summary, decision_made,
                     reasoning, confidence, assumptions, expected_outcomes, created_at)
                    VALUES
                    (:id, :agent_name, :task_id, :context_summary, :decision_made,
                     :reasoning, :confidence, :assumptions, :expected_outcomes, NOW())
                """),
                {
                    "id": signature.id,
                    "agent_name": signature.agent_name,
                    "task_id": signature.task_id,
                    "context_summary": signature.context_summary,
                    "decision_made": signature.decision_made,
                    "reasoning": signature.reasoning,
                    "confidence": signature.confidence,
                    "assumptions": json_dumps(signature.assumptions),
                    "expected_outcomes": json_dumps(signature.expected_outcomes),
                },
            )
            await session.commit()

        logger.debug("Thought signature saved", signature_id=signature.id)
        return signature.id

    async def get_recent(self, agent_name: str | None = None, limit: int = 50) -> list[ThoughtSignature]:
        """Get recent thought signatures."""
        async with AsyncSessionLocal() as session:
            if agent_name:
                result = await session.execute(
                    text("""
                        SELECT * FROM thought_signatures
                        WHERE agent_name = :agent_name
                        ORDER BY created_at DESC
                        LIMIT :limit
                    """),
                    {"agent_name": agent_name, "limit": limit},
                )
            else:
                result = await session.execute(
                    text("""
                        SELECT * FROM thought_signatures
                        ORDER BY created_at DESC
                        LIMIT :limit
                    """),
                    {"limit": limit},
                )

            rows = result.fetchall()
            return [self._row_to_signature(row) for row in rows]

    def _row_to_signature(self, row) -> ThoughtSignature:
        """Convert database row to ThoughtSignature."""
        return ThoughtSignature(
            id=row[0],
            agent_name=row[1],
            task_id=row[2],
            context_summary=row[3],
            decision_made=row[4],
            reasoning=row[5],
            confidence=row[6],
            assumptions=json.loads(row[7]) if row[7] else [],
            expected_outcomes=json.loads(row[8]) if row[8] else [],
            actual_outcomes=json.loads(row[9]) if row[9] else None,
            created_at=row[10],
        )

    async def update_actual_outcomes(self, signature_id: str, outcomes: list[str]) -> None:
        """Update actual outcomes for a thought signature."""
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("""
                    UPDATE thought_signatures
                    SET actual_outcomes = :outcomes
                    WHERE id = :id
                """),
                {"id": signature_id, "outcomes": json_dumps(outcomes)},
            )
            await session.commit()
