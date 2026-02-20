"""Chat API endpoints for RAG-based Q&A."""

from datetime import datetime
from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from src.db import AsyncSessionLocal
from src.rag import get_rag_engine

logger = structlog.get_logger()
router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""

    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: str | None = None
    content_types: list[str] | None = None


class SourceResponse(BaseModel):
    """Source citation in response."""

    id: str
    content_type: str
    title: str
    relevance: float
    snippet: str | None = None
    paper_id: str | None = None


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""

    answer: str
    sources: list[SourceResponse]
    follow_up_questions: list[str]
    confidence: float
    conversation_id: str
    message_id: str


class ConversationMessage(BaseModel):
    """A message in a conversation."""

    id: str
    role: str
    content: str
    sources: list[SourceResponse] | None = None
    created_at: datetime


class ConversationResponse(BaseModel):
    """Response model for conversation retrieval."""

    id: str
    messages: list[ConversationMessage]
    created_at: datetime


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Send a message and receive an AI-generated response based on the research corpus.

    The response includes:
    - An answer synthesized from relevant papers, claims, and techniques
    - Source citations with relevance scores
    - Suggested follow-up questions

    Optionally provide a conversation_id to continue a previous conversation.
    """
    try:
        rag = await get_rag_engine()

        # Get or create conversation
        conversation_id = request.conversation_id or str(uuid4())

        # Get conversation history if continuing
        history_context = None
        if request.conversation_id:
            history = await _get_conversation_history(request.conversation_id, limit=5)
            if history:
                history_context = "\n".join(
                    f"{msg['role'].upper()}: {msg['content'][:200]}" for msg in history
                )

        # Query the RAG engine
        if history_context:
            response = await rag.answer_with_context(
                question=request.message,
                additional_context=f"Previous conversation:\n{history_context}",
            )
        else:
            response = await rag.query(
                question=request.message,
                content_types=request.content_types,
            )

        # Generate message ID
        message_id = str(uuid4())

        # Store the conversation
        sources_json = [
            {
                "id": s.id,
                "content_type": s.content_type,
                "title": s.title,
                "relevance": s.relevance,
                "snippet": s.snippet,
                "paper_id": s.paper_id,
            }
            for s in response.sources
        ]

        await _store_message(
            conversation_id=conversation_id,
            message_id=message_id,
            role="user",
            content=request.message,
            sources=None,
        )

        assistant_message_id = str(uuid4())
        await _store_message(
            conversation_id=conversation_id,
            message_id=assistant_message_id,
            role="assistant",
            content=response.answer,
            sources=sources_json,
        )

        return ChatResponse(
            answer=response.answer,
            sources=[
                SourceResponse(
                    id=s.id,
                    content_type=s.content_type,
                    title=s.title,
                    relevance=s.relevance,
                    snippet=s.snippet,
                    paper_id=s.paper_id,
                )
                for s in response.sources
            ],
            follow_up_questions=response.follow_up_questions,
            confidence=response.confidence,
            conversation_id=conversation_id,
            message_id=assistant_message_id,
        )

    except Exception as e:
        logger.error("Chat error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}") from e


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str) -> ConversationResponse:
    """Get the full history of a conversation."""
    try:
        async with AsyncSessionLocal() as session:
            # Get conversation
            result = await session.execute(
                text("SELECT id, created_at FROM chat_conversations WHERE id = :id"),
                {"id": conversation_id},
            )
            conv = result.fetchone()

            if not conv:
                raise HTTPException(status_code=404, detail="Conversation not found")

            # Get messages
            result = await session.execute(
                text(
                    """
                    SELECT id, role, content, sources, created_at
                    FROM chat_messages
                    WHERE conversation_id = :conversation_id
                    ORDER BY created_at ASC
                """
                ),
                {"conversation_id": conversation_id},
            )
            rows = result.fetchall()

            messages = []
            for row in rows:
                sources = None
                if row.sources:
                    sources = [SourceResponse(**s) for s in row.sources]
                messages.append(
                    ConversationMessage(
                        id=str(row.id),
                        role=row.role,
                        content=row.content,
                        sources=sources,
                        created_at=row.created_at,
                    )
                )

            return ConversationResponse(
                id=conversation_id,
                messages=messages,
                created_at=conv.created_at,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get conversation", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str) -> dict[str, str]:
    """Delete a conversation and all its messages."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM chat_conversations WHERE id = :id"),
                {"id": conversation_id},
            )
            await session.commit()

        return {"status": "deleted", "conversation_id": conversation_id}

    except Exception as e:
        logger.error("Failed to delete conversation", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


async def _get_conversation_history(
    conversation_id: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Get recent messages from a conversation."""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text(
                    """
                    SELECT role, content
                    FROM chat_messages
                    WHERE conversation_id = :conversation_id
                    ORDER BY created_at DESC
                    LIMIT :limit
                """
                ),
                {"conversation_id": conversation_id, "limit": limit},
            )
            rows = result.fetchall()

            return [{"role": row.role, "content": row.content} for row in reversed(rows)]
    except Exception as e:
        logger.warning("Failed to get conversation history", error=str(e))
        return []


async def _store_message(
    conversation_id: str,
    message_id: str,
    role: str,
    content: str,
    sources: list[dict[str, Any]] | None,
) -> None:
    """Store a message in the database."""
    try:
        async with AsyncSessionLocal() as session:
            # Ensure conversation exists
            await session.execute(
                text(
                    """
                    INSERT INTO chat_conversations (id, created_at, updated_at)
                    VALUES (:id, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
                """
                ),
                {"id": conversation_id},
            )

            # Insert message
            import json

            await session.execute(
                text(
                    """
                    INSERT INTO chat_messages (id, conversation_id, role, content, sources, created_at)
                    VALUES (:id, :conversation_id, :role, :content, :sources, NOW())
                """
                ),
                {
                    "id": message_id,
                    "conversation_id": conversation_id,
                    "role": role,
                    "content": content,
                    "sources": json.dumps(sources) if sources else None,
                },
            )
            await session.commit()

    except Exception as e:
        logger.warning("Failed to store message", error=str(e))
