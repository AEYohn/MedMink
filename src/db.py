"""Database connection management."""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as redis
import structlog
from neo4j import AsyncGraphDatabase, AsyncDriver
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from src.config import settings

logger = structlog.get_logger()

# SQLAlchemy setup
engine = create_async_engine(
    settings.postgres_url,
    echo=settings.environment == "development",
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Neo4j setup
_neo4j_driver: AsyncDriver | None = None


async def get_neo4j_driver(max_retries: int = 2, retry_delay: float = 2.0) -> AsyncDriver:
    """Get or create Neo4j driver with retry logic."""
    global _neo4j_driver
    if _neo4j_driver is None:
        _neo4j_driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
        # Verify connectivity with retries
        for attempt in range(max_retries):
            try:
                await _neo4j_driver.verify_connectivity()
                logger.info("Neo4j connection established")
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Neo4j not ready, retrying in {retry_delay}s... (attempt {attempt + 1}/{max_retries})")
                    await asyncio.sleep(retry_delay)
                else:
                    logger.warning("Failed to connect to Neo4j after retries - continuing without it", error=str(e))
                    _neo4j_driver = None
                    return None
    return _neo4j_driver


@asynccontextmanager
async def get_neo4j_session():
    """Get Neo4j session context manager."""
    driver = await get_neo4j_driver()
    async with driver.session() as session:
        yield session


async def close_neo4j():
    """Close Neo4j driver."""
    global _neo4j_driver
    if _neo4j_driver:
        await _neo4j_driver.close()
        _neo4j_driver = None
        logger.info("Neo4j connection closed")


# Redis setup
_redis_client: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    """Get or create Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        # Verify connectivity
        await _redis_client.ping()
        logger.info("Redis connection established")
    return _redis_client


async def close_redis():
    """Close Redis client."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis connection closed")


# Initialization
async def init_databases():
    """Initialize all database connections."""
    try:
        await get_neo4j_driver()
    except Exception as e:
        logger.warning("Neo4j initialization failed, continuing without it", error=str(e))

    try:
        await get_redis()
    except Exception as e:
        logger.warning("Redis initialization failed, continuing without it", error=str(e))

    logger.info("Database connections initialized")


async def close_databases():
    """Close all database connections."""
    await close_neo4j()
    await close_redis()
    await engine.dispose()
    logger.info("All database connections closed")


# Health checks
async def check_postgres_health() -> bool:
    """Check PostgreSQL health."""
    from sqlalchemy import text
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("PostgreSQL health check failed", error=str(e))
        return False


async def check_neo4j_health() -> bool:
    """Check Neo4j health."""
    try:
        driver = await get_neo4j_driver()
        await driver.verify_connectivity()
        return True
    except Exception as e:
        logger.error("Neo4j health check failed", error=str(e))
        return False


async def check_redis_health() -> bool:
    """Check Redis health."""
    try:
        client = await get_redis()
        await client.ping()
        return True
    except Exception as e:
        logger.error("Redis health check failed", error=str(e))
        return False


async def health_check() -> dict:
    """Run all health checks."""
    results = await asyncio.gather(
        check_postgres_health(),
        check_neo4j_health(),
        check_redis_health(),
        return_exceptions=True,
    )

    return {
        "postgres": results[0] if isinstance(results[0], bool) else False,
        "neo4j": results[1] if isinstance(results[1], bool) else False,
        "redis": results[2] if isinstance(results[2], bool) else False,
        "healthy": all(r is True for r in results),
    }
