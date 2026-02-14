"""API dependencies."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_db
from src.gemini import GeminiClient, get_gemini_client
from src.kg import KnowledgeGraph, get_knowledge_graph
from src.orchestrator.state import TaskQueue, ThoughtSignatureStore


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session dependency."""
    async for session in get_db():
        yield session


async def get_kg() -> KnowledgeGraph:
    """Get knowledge graph dependency."""
    return await get_knowledge_graph()


def get_gemini() -> GeminiClient:
    """Get Gemini client dependency."""
    return get_gemini_client()


def get_task_queue() -> TaskQueue:
    """Get task queue dependency."""
    return TaskQueue()


def get_thought_store() -> ThoughtSignatureStore:
    """Get thought signature store dependency."""
    return ThoughtSignatureStore()
