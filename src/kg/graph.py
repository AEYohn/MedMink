"""Knowledge Graph operations with Neo4j."""

import asyncio
from datetime import datetime, timedelta
from typing import Any, TypeVar

import structlog
from neo4j import AsyncDriver

from src.db import get_neo4j_driver
from src.kg.models import (
    AddressedByRelation,
    ApproachNode,
    BaseNode,
    ClaimNode,
    ContradictsRelation,
    MethodNode,
    PaperNode,
    PatternNode,
    PredictionNode,
    ProblemNode,
    ProjectNode,
    TechniqueNode,
    TrendNode,
)
from src.kg.queries import CypherQueries

logger = structlog.get_logger()

T = TypeVar("T", bound=BaseNode)


class KnowledgeGraph:
    """High-level interface for knowledge graph operations."""

    def __init__(self, driver: AsyncDriver | None = None):
        self._driver = driver

    async def _get_driver(self) -> AsyncDriver:
        """Get Neo4j driver."""
        if self._driver is None:
            self._driver = await get_neo4j_driver()
        return self._driver

    async def setup_schema(self) -> None:
        """Set up database constraints and indexes."""
        driver = await self._get_driver()
        async with driver.session() as session:
            # Create constraints one by one (some may already exist)
            constraints = [
                "CREATE CONSTRAINT paper_id IF NOT EXISTS FOR (p:Paper) REQUIRE p.id IS UNIQUE",
                "CREATE CONSTRAINT paper_arxiv_id IF NOT EXISTS FOR (p:Paper) REQUIRE p.arxiv_id IS UNIQUE",
                "CREATE CONSTRAINT claim_id IF NOT EXISTS FOR (c:Claim) REQUIRE c.id IS UNIQUE",
                "CREATE CONSTRAINT method_id IF NOT EXISTS FOR (m:Method) REQUIRE m.id IS UNIQUE",
                "CREATE CONSTRAINT trend_id IF NOT EXISTS FOR (t:Trend) REQUIRE t.id IS UNIQUE",
                "CREATE CONSTRAINT prediction_id IF NOT EXISTS FOR (p:Prediction) REQUIRE p.id IS UNIQUE",
                "CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE",
                "CREATE CONSTRAINT problem_id IF NOT EXISTS FOR (p:Problem) REQUIRE p.id IS UNIQUE",
                "CREATE CONSTRAINT approach_id IF NOT EXISTS FOR (a:Approach) REQUIRE a.id IS UNIQUE",
            ]

            indexes = [
                "CREATE INDEX paper_published IF NOT EXISTS FOR (p:Paper) ON (p.published_date)",
                "CREATE INDEX paper_analyzed IF NOT EXISTS FOR (p:Paper) ON (p.analyzed)",
                "CREATE INDEX claim_status IF NOT EXISTS FOR (c:Claim) ON (c.status)",
                "CREATE INDEX claim_category IF NOT EXISTS FOR (c:Claim) ON (c.category)",
                "CREATE INDEX trend_direction IF NOT EXISTS FOR (t:Trend) ON (t.direction)",
                "CREATE INDEX prediction_outcome IF NOT EXISTS FOR (p:Prediction) ON (p.outcome)",
                "CREATE INDEX project_status IF NOT EXISTS FOR (p:Project) ON (p.status)",
                "CREATE INDEX project_source IF NOT EXISTS FOR (p:Project) ON (p.source)",
                "CREATE INDEX problem_category IF NOT EXISTS FOR (p:Problem) ON (p.category)",
                "CREATE INDEX problem_project IF NOT EXISTS FOR (p:Problem) ON (p.project_id)",
            ]

            for query in constraints + indexes:
                try:
                    await session.run(query)
                except Exception as e:
                    logger.debug(
                        "Schema setup query (may already exist)", query=query[:50], error=str(e)
                    )

            logger.info("Knowledge graph schema setup complete")

    # Paper operations

    async def add_paper(self, paper: PaperNode) -> PaperNode:
        """Add or update a paper in the graph."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.merge_node("Paper", "arxiv_id"),
                props=paper.to_dict(),
            )
            await result.single()
            logger.info("Paper added/updated", arxiv_id=paper.arxiv_id)
            return paper

    async def get_paper(self, paper_id: str) -> PaperNode | None:
        """Get a paper by ID."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.get_node("Paper"),
                value=paper_id,
            )
            record = await result.single()
            if record:
                return self._record_to_paper(record["n"])
            return None

    async def get_paper_by_arxiv_id(self, arxiv_id: str) -> PaperNode | None:
        """Get a paper by arxiv ID."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.get_node("Paper", "arxiv_id"),
                value=arxiv_id,
            )
            record = await result.single()
            if record:
                return self._record_to_paper(record["n"])
            return None

    async def get_unanalyzed_papers(self, limit: int = 100) -> list[PaperNode]:
        """Get papers that haven't been analyzed yet."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.GET_UNANALYZED_PAPERS,
                limit=limit,
            )
            records = await result.data()
            return [self._record_to_paper(r["p"]) for r in records]

    async def mark_paper_analyzed(self, paper_id: str) -> None:
        """Mark a paper as analyzed."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                "MATCH (p:Paper {id: $id}) SET p.analyzed = true",
                id=paper_id,
            )

    # Claim operations

    async def add_claim(self, claim: ClaimNode, paper_id: str) -> ClaimNode:
        """Add a claim and link it to its paper."""
        driver = await self._get_driver()
        async with driver.session() as session:
            # Create the claim
            await session.run(
                CypherQueries.merge_node("Claim"),
                props=claim.to_dict(),
            )

            # Link to paper
            await session.run(
                CypherQueries.create_relationship("Paper", "Claim", "CONTAINS"),
                source_id=paper_id,
                target_id=claim.id,
                props={"created_at": datetime.utcnow().isoformat()},
            )

            logger.debug("Claim added", claim_id=claim.id, paper_id=paper_id)
            return claim

    async def get_claims_for_paper(self, paper_id: str) -> list[ClaimNode]:
        """Get all claims for a paper."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.GET_CLAIMS_FOR_PAPER,
                paper_id=paper_id,
            )
            records = await result.data()
            return [self._record_to_claim(r["c"]) for r in records]

    async def get_all_claims(self, limit: int = 1000) -> list[ClaimNode]:
        """Get all claims."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.get_nodes("Claim", limit),
            )
            records = await result.data()
            return [self._record_to_claim(r["n"]) for r in records]

    async def update_claim_status(self, claim_id: str, status: str) -> None:
        """Update a claim's status."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                "MATCH (c:Claim {id: $id}) SET c.status = $status",
                id=claim_id,
                status=status,
            )

    # Contradiction operations

    async def add_contradiction(
        self,
        claim1_id: str,
        claim2_id: str,
        strength: float,
        explanation: str,
        contradiction_type: str = "direct",
        possible_reconciliation: str | None = None,
    ) -> ContradictsRelation:
        """Add a contradiction relationship between two claims."""
        driver = await self._get_driver()
        async with driver.session() as session:
            rel = ContradictsRelation(
                source_id=claim1_id,
                target_id=claim2_id,
                strength=strength,
                explanation=explanation,
                contradiction_type=contradiction_type,
                possible_reconciliation=possible_reconciliation,
            )

            await session.run(
                CypherQueries.merge_relationship("Claim", "Claim", "CONTRADICTS"),
                source_id=claim1_id,
                target_id=claim2_id,
                props=rel.to_dict(),
            )

            # Update claim statuses to contested
            await session.run(
                """
                MATCH (c:Claim) WHERE c.id IN [$id1, $id2]
                SET c.status = 'contested'
                """,
                id1=claim1_id,
                id2=claim2_id,
            )

            logger.info(
                "Contradiction added",
                claim1=claim1_id,
                claim2=claim2_id,
                strength=strength,
            )
            return rel

    async def get_contradictions(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get all contradictions."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.GET_CONTRADICTIONS,
                limit=limit,
            )
            records = await result.data()
            return [
                {
                    "claim1": self._record_to_claim(r["c1"]),
                    "claim2": self._record_to_claim(r["c2"]),
                    "relation": dict(r["r"]),
                }
                for r in records
            ]

    async def get_potential_contradictions(
        self, limit: int = 50
    ) -> list[tuple[ClaimNode, ClaimNode]]:
        """Get pairs of claims that might contradict each other."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.FIND_POTENTIAL_CONTRADICTIONS,
                limit=limit,
            )
            records = await result.data()
            return [
                (self._record_to_claim(r["c1"]), self._record_to_claim(r["c2"])) for r in records
            ]

    # Method operations

    async def add_method(
        self, method: MethodNode, paper_id: str | None = None, is_novel: bool = False
    ) -> MethodNode:
        """Add or update a method."""
        driver = await self._get_driver()
        async with driver.session() as session:
            # Try to merge by name
            result = await session.run(
                """
                MERGE (m:Method {name: $name})
                ON CREATE SET m = $props
                ON MATCH SET m.paper_count = m.paper_count + 1
                RETURN m
                """,
                name=method.name,
                props=method.to_dict(),
            )
            await result.single()

            # Link to paper if provided
            if paper_id:
                rel_type = "INTRODUCES" if is_novel else "USES_METHOD"
                await session.run(
                    f"""
                    MATCH (p:Paper {{id: $paper_id}})
                    MATCH (m:Method {{name: $method_name}})
                    MERGE (p)-[r:{rel_type}]->(m)
                    """,
                    paper_id=paper_id,
                    method_name=method.name,
                )

            logger.debug("Method added/updated", name=method.name)
            return method

    async def get_popular_methods(self, limit: int = 20) -> list[MethodNode]:
        """Get the most popular methods."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.GET_POPULAR_METHODS,
                limit=limit,
            )
            records = await result.data()
            return [self._record_to_method(r["m"]) for r in records]

    # Technique operations

    async def add_technique(
        self, technique: "TechniqueNode", paper_id: str | None = None
    ) -> "TechniqueNode":
        """Add or update a technique."""
        driver = await self._get_driver()
        async with driver.session() as session:
            # Merge by name
            result = await session.run(
                """
                MERGE (t:Technique {name: $name})
                ON CREATE SET t = $props
                ON MATCH SET t.paper_count = t.paper_count + 1
                RETURN t
                """,
                name=technique.name,
                props=technique.to_dict(),
            )
            await result.single()

            # Link to paper if provided
            if paper_id:
                rel_type = "INTRODUCES_TECHNIQUE" if technique.is_novel else "USES_TECHNIQUE"
                await session.run(
                    f"""
                    MATCH (p:Paper {{id: $paper_id}})
                    MATCH (t:Technique {{name: $technique_name}})
                    MERGE (p)-[r:{rel_type}]->(t)
                    """,
                    paper_id=paper_id,
                    technique_name=technique.name,
                )

            logger.debug(
                "Technique added/updated", name=technique.name, type=technique.technique_type
            )
            return technique

    async def get_techniques(self, limit: int = 100) -> list["TechniqueNode"]:
        """Get all techniques."""
        from src.kg.models import TechniqueNode

        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (t:Technique)
                RETURN t
                ORDER BY t.paper_count DESC
                LIMIT $limit
                """,
                limit=limit,
            )
            records = await result.data()
            return [
                TechniqueNode(
                    id=r["t"].get("id", ""),
                    name=r["t"].get("name", ""),
                    technique_type=r["t"].get("technique_type", "other"),
                    description=r["t"].get("description", ""),
                    formula=r["t"].get("formula"),
                    pseudocode=r["t"].get("pseudocode"),
                    implementation_notes=r["t"].get("implementation_notes"),
                    is_novel=r["t"].get("is_novel", False),
                    improves_upon=r["t"].get("improves_upon"),
                    paper_count=r["t"].get("paper_count", 1),
                )
                for r in records
            ]

    # Pattern operations

    async def add_pattern(self, pattern: PatternNode) -> PatternNode:
        """Add or update a pattern."""
        driver = await self._get_driver()
        async with driver.session() as session:
            # Merge by name
            result = await session.run(
                """
                MERGE (p:Pattern {name: $name})
                ON CREATE SET p = $props
                ON MATCH SET p.frequency = p.frequency + 1
                RETURN p
                """,
                name=pattern.name,
                props=pattern.to_dict(),
            )
            await result.single()
            logger.info("Pattern added/updated", name=pattern.name, type=pattern.pattern_type)
            return pattern

    async def get_patterns(self, limit: int = 100) -> list[PatternNode]:
        """Get all patterns."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (p:Pattern)
                RETURN p
                ORDER BY p.frequency DESC
                LIMIT $limit
                """,
                limit=limit,
            )
            records = await result.data()
            return [
                PatternNode(
                    id=r["p"].get("id", ""),
                    name=r["p"].get("name", ""),
                    pattern_type=r["p"].get("pattern_type", ""),
                    template=r["p"].get("template", ""),
                    description=r["p"].get("description", ""),
                    key_components=r["p"].get("key_components", []),
                    common_techniques=r["p"].get("common_techniques", []),
                    example_applications=r["p"].get("example_applications", []),
                    domains=r["p"].get("domains", []),
                    frequency=r["p"].get("frequency", 1),
                    novelty_score=r["p"].get("novelty_score"),
                    effectiveness_score=r["p"].get("effectiveness_score"),
                )
                for r in records
            ]

    async def get_pattern(self, pattern_id: str) -> PatternNode | None:
        """Get a specific pattern by ID."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                "MATCH (p:Pattern {id: $id}) RETURN p",
                id=pattern_id,
            )
            record = await result.single()
            if not record:
                return None
            r = record["p"]
            return PatternNode(
                id=r.get("id", ""),
                name=r.get("name", ""),
                pattern_type=r.get("pattern_type", ""),
                template=r.get("template", ""),
                description=r.get("description", ""),
                key_components=r.get("key_components", []),
                common_techniques=r.get("common_techniques", []),
                example_applications=r.get("example_applications", []),
                domains=r.get("domains", []),
                frequency=r.get("frequency", 1),
                novelty_score=r.get("novelty_score"),
                effectiveness_score=r.get("effectiveness_score"),
            )

    async def link_paper_to_pattern(
        self,
        paper_id: str,
        pattern_id: str,
        adherence_score: float = 0.5,
    ) -> None:
        """Link a paper to a pattern it follows."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                """
                MATCH (p:Paper {id: $paper_id})
                MATCH (pat:Pattern {id: $pattern_id})
                MERGE (p)-[r:FOLLOWS_PATTERN]->(pat)
                SET r.adherence_score = $adherence_score,
                    r.created_at = $created_at
                """,
                paper_id=paper_id,
                pattern_id=pattern_id,
                adherence_score=adherence_score,
                created_at=datetime.utcnow().isoformat(),
            )

    async def get_papers_by_pattern(self, pattern_id: str, limit: int = 50) -> list[PaperNode]:
        """Get papers that follow a specific pattern."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (p:Paper)-[:FOLLOWS_PATTERN]->(pat:Pattern {id: $pattern_id})
                RETURN p
                ORDER BY p.published_date DESC
                LIMIT $limit
                """,
                pattern_id=pattern_id,
                limit=limit,
            )
            records = await result.data()
            return [self._record_to_paper(r["p"]) for r in records]

    async def clear_all_data(self) -> dict[str, int]:
        """Clear all data from the knowledge graph. USE WITH CAUTION."""
        driver = await self._get_driver()
        async with driver.session() as session:
            # Get counts before deletion
            stats_result = await session.run("""
                MATCH (n)
                RETURN labels(n)[0] as label, count(n) as count
            """)
            counts_before = {r["label"]: r["count"] for r in await stats_result.data()}

            # Delete all relationships first
            await session.run("MATCH ()-[r]-() DELETE r")

            # Delete all nodes
            await session.run("MATCH (n) DELETE n")

            logger.warning("All data cleared from knowledge graph", counts_deleted=counts_before)
            return counts_before

    # Trend operations

    async def add_trend(self, trend: TrendNode) -> TrendNode:
        """Add or update a trend."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                CypherQueries.merge_node("Trend"),
                props=trend.to_dict(),
            )
            logger.info("Trend added/updated", name=trend.name, direction=trend.direction)
            return trend

    async def get_trends(self, limit: int = 50) -> list[TrendNode]:
        """Get all trends."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.get_nodes("Trend", limit),
            )
            records = await result.data()
            return [self._record_to_trend(r["n"]) for r in records]

    async def get_rising_trends(self, limit: int = 20) -> list[TrendNode]:
        """Get rising trends."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.GET_RISING_TRENDS,
                limit=limit,
            )
            records = await result.data()
            return [self._record_to_trend(r["t"]) for r in records]

    async def link_trend_to_claim(
        self, trend_id: str, claim_id: str, contribution: float = 0.5
    ) -> None:
        """Link a trend to a claim."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                CypherQueries.merge_relationship("Trend", "Claim", "INVOLVES"),
                source_id=trend_id,
                target_id=claim_id,
                props={"contribution": contribution, "created_at": datetime.utcnow().isoformat()},
            )

    # Prediction operations

    async def add_prediction(
        self, prediction: PredictionNode, trend_ids: list[str] | None = None
    ) -> PredictionNode:
        """Add a prediction."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                CypherQueries.merge_node("Prediction"),
                props=prediction.to_dict(),
            )

            # Link to trends
            if trend_ids:
                for trend_id in trend_ids:
                    await session.run(
                        CypherQueries.merge_relationship("Prediction", "Trend", "BASED_ON"),
                        source_id=prediction.id,
                        target_id=trend_id,
                        props={"created_at": datetime.utcnow().isoformat()},
                    )

            logger.info("Prediction added", id=prediction.id, statement=prediction.statement[:50])
            return prediction

    async def get_pending_predictions(self) -> list[PredictionNode]:
        """Get predictions that haven't been resolved yet."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(CypherQueries.GET_PENDING_PREDICTIONS)
            records = await result.data()
            return [self._record_to_prediction(r["p"]) for r in records]

    async def get_due_predictions(self) -> list[PredictionNode]:
        """Get predictions that are past their due date."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(CypherQueries.GET_DUE_PREDICTIONS)
            records = await result.data()
            return [self._record_to_prediction(r["p"]) for r in records]

    async def update_prediction_outcome(
        self,
        prediction_id: str,
        outcome: str,
        outcome_details: str | None = None,
    ) -> None:
        """Update a prediction's outcome."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                CypherQueries.UPDATE_PREDICTION_OUTCOME,
                prediction_id=prediction_id,
                outcome=outcome,
                outcome_details=outcome_details,
            )
            logger.info("Prediction outcome updated", id=prediction_id, outcome=outcome)

    async def get_prediction_accuracy(self) -> dict[str, Any]:
        """Get prediction accuracy statistics."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(CypherQueries.GET_PREDICTION_ACCURACY)
            record = await result.single()
            if record:
                total = record["total"]
                correct = record["correct"]
                if total > 0:
                    accuracy = correct / total
                    # Brier score approximation
                    brier = 1 - accuracy
                else:
                    accuracy = 0
                    brier = 1

                return {
                    "total": total,
                    "correct": correct,
                    "incorrect": record["incorrect"],
                    "partial": record["partial"],
                    "accuracy": accuracy,
                    "brier_score": brier,
                    "avg_confidence": record["avg_confidence"],
                }
            return {"total": 0, "accuracy": 0}

    # Statistics

    async def get_stats(self) -> dict[str, Any]:
        """Get graph statistics."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(CypherQueries.GET_GRAPH_STATS)
            record = await result.single()
            if record:
                return dict(record)
            return {}

    async def get_weekly_stats(self, start_date: datetime | None = None) -> dict[str, Any]:
        """Get statistics for the past week."""
        if start_date is None:
            start_date = datetime.utcnow() - timedelta(days=7)

        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.GET_WEEKLY_STATS,
                start_date=start_date.isoformat(),
            )
            record = await result.single()
            if record:
                return dict(record)
            return {}

    # Helper methods for converting records to models

    def _record_to_paper(self, record: dict) -> PaperNode:
        return PaperNode(
            id=record.get("id", ""),
            arxiv_id=record.get("arxiv_id", ""),
            title=record.get("title", ""),
            abstract=record.get("abstract", ""),
            authors=record.get("authors", []),
            categories=record.get("categories", []),
            published_date=self._parse_datetime(record.get("published_date")),
            pdf_url=record.get("pdf_url"),
            citation_count=record.get("citation_count", 0),
            analyzed=record.get("analyzed", False),
            created_at=self._parse_datetime(record.get("created_at")) or datetime.utcnow(),
        )

    def _record_to_claim(self, record: dict) -> ClaimNode:
        return ClaimNode(
            id=record.get("id", ""),
            paper_id=record.get("paper_id", ""),
            statement=record.get("statement", ""),
            category=record.get("category", ""),
            status=record.get("status", "unverified"),
            confidence=record.get("confidence", 0.5),
            evidence=record.get("evidence"),
            context=record.get("context"),
            quantitative=record.get("quantitative", False),
            created_at=self._parse_datetime(record.get("created_at")) or datetime.utcnow(),
        )

    def _record_to_method(self, record: dict) -> MethodNode:
        return MethodNode(
            id=record.get("id", ""),
            name=record.get("name", ""),
            description=record.get("description", ""),
            category=record.get("category"),
            first_paper_id=record.get("first_paper_id"),
            paper_count=record.get("paper_count", 1),
            is_novel=record.get("is_novel", False),
            created_at=self._parse_datetime(record.get("created_at")) or datetime.utcnow(),
        )

    def _record_to_trend(self, record: dict) -> TrendNode:
        return TrendNode(
            id=record.get("id", ""),
            name=record.get("name", ""),
            description=record.get("description", ""),
            direction=record.get("direction", "rising"),
            velocity=record.get("velocity", 0.0),
            confidence=record.get("confidence", 0.5),
            first_seen=self._parse_datetime(record.get("first_seen")) or datetime.utcnow(),
            last_updated=self._parse_datetime(record.get("last_updated")) or datetime.utcnow(),
            created_at=self._parse_datetime(record.get("created_at")) or datetime.utcnow(),
        )

    def _record_to_prediction(self, record: dict) -> PredictionNode:
        return PredictionNode(
            id=record.get("id", ""),
            statement=record.get("statement", ""),
            category=record.get("category", ""),
            confidence=record.get("confidence", 0.5),
            timeframe=record.get("timeframe", "3_months"),
            reasoning=record.get("reasoning"),
            made_at=self._parse_datetime(record.get("made_at")) or datetime.utcnow(),
            due_date=self._parse_datetime(record.get("due_date")),
            outcome=record.get("outcome", "pending"),
            outcome_details=record.get("outcome_details"),
            resolved_at=self._parse_datetime(record.get("resolved_at")),
            created_at=self._parse_datetime(record.get("created_at")) or datetime.utcnow(),
        )

    def _parse_datetime(self, value: Any) -> datetime | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return None
        return None

    # Project operations

    async def add_project(self, project: ProjectNode) -> ProjectNode:
        """Add or update a project in the graph."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                CypherQueries.merge_node("Project"),
                props=project.to_dict(),
            )
            logger.info("Project added/updated", project_id=project.id, name=project.name)
            return project

    async def get_project(self, project_id: str) -> ProjectNode | None:
        """Get a project by ID."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                CypherQueries.get_node("Project"),
                value=project_id,
            )
            record = await result.single()
            if record:
                return self._record_to_project(record["n"])
            return None

    async def get_projects(self, limit: int = 50, status: str | None = None) -> list[ProjectNode]:
        """Get all projects, optionally filtered by status."""
        driver = await self._get_driver()
        async with driver.session() as session:
            if status:
                result = await session.run(
                    """
                    MATCH (p:Project {status: $status})
                    RETURN p
                    ORDER BY p.created_at DESC
                    LIMIT $limit
                    """,
                    status=status,
                    limit=limit,
                )
            else:
                result = await session.run(
                    CypherQueries.get_nodes("Project", limit),
                )
            records = await result.data()
            return [self._record_to_project(r["n"] if "n" in r else r["p"]) for r in records]

    async def update_project_status(
        self, project_id: str, status: str, error_message: str | None = None
    ) -> None:
        """Update a project's status."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                """
                MATCH (p:Project {id: $id})
                SET p.status = $status, p.error_message = $error_message
                """,
                id=project_id,
                status=status,
                error_message=error_message,
            )
            logger.info("Project status updated", project_id=project_id, status=status)

    async def add_problem(self, problem: ProblemNode, project_id: str) -> ProblemNode:
        """Add a problem and link it to its project."""
        driver = await self._get_driver()
        async with driver.session() as session:
            # Create the problem
            await session.run(
                CypherQueries.merge_node("Problem"),
                props=problem.to_dict(),
            )

            # Link to project
            await session.run(
                CypherQueries.create_relationship("Project", "Problem", "HAS_PROBLEM"),
                source_id=project_id,
                target_id=problem.id,
                props={"created_at": datetime.utcnow().isoformat()},
            )

            logger.debug("Problem added", problem_id=problem.id, project_id=project_id)
            return problem

    async def get_problems_for_project(self, project_id: str) -> list[ProblemNode]:
        """Get all problems for a project."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (p:Project {id: $project_id})-[:HAS_PROBLEM]->(prob:Problem)
                RETURN prob
                ORDER BY prob.priority DESC
                """,
                project_id=project_id,
            )
            records = await result.data()
            return [self._record_to_problem(r["prob"]) for r in records]

    async def link_paper_to_problem(
        self,
        paper_id: str,
        problem_id: str,
        relevance: float,
        explanation: str | None = None,
        aspects_addressed: list[str] | None = None,
    ) -> AddressedByRelation:
        """Link a paper to a problem it addresses."""
        driver = await self._get_driver()
        async with driver.session() as session:
            rel = AddressedByRelation(
                source_id=problem_id,
                target_id=paper_id,
                relevance=relevance,
                explanation=explanation,
                aspects_addressed=aspects_addressed or [],
            )

            await session.run(
                CypherQueries.merge_relationship("Problem", "Paper", "ADDRESSED_BY"),
                source_id=problem_id,
                target_id=paper_id,
                props=rel.to_dict(),
            )

            logger.debug(
                "Paper linked to problem",
                paper_id=paper_id,
                problem_id=problem_id,
                relevance=relevance,
            )
            return rel

    async def add_approach(self, approach: ApproachNode, project_id: str) -> ApproachNode:
        """Add a solution approach and link it to its project."""
        driver = await self._get_driver()
        async with driver.session() as session:
            # Create the approach
            await session.run(
                CypherQueries.merge_node("Approach"),
                props=approach.to_dict(),
            )

            # Link to project
            await session.run(
                """
                MATCH (p:Project {id: $project_id})
                MATCH (a:Approach {id: $approach_id})
                MERGE (p)-[r:HAS_APPROACH]->(a)
                """,
                project_id=project_id,
                approach_id=approach.id,
            )

            logger.debug("Approach added", approach_id=approach.id, project_id=project_id)
            return approach

    async def link_approach_to_method(
        self,
        approach_id: str,
        method_id: str,
        importance: float = 0.5,
    ) -> None:
        """Link an approach to a method/technique it uses."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                CypherQueries.merge_relationship("Approach", "Method", "USES_TECHNIQUE"),
                source_id=approach_id,
                target_id=method_id,
                props={"importance": importance, "created_at": datetime.utcnow().isoformat()},
            )

    async def link_approach_to_claim(self, approach_id: str, claim_id: str) -> None:
        """Link an approach to a research claim it's based on."""
        driver = await self._get_driver()
        async with driver.session() as session:
            await session.run(
                CypherQueries.merge_relationship("Approach", "Claim", "BASED_ON_CLAIM"),
                source_id=approach_id,
                target_id=claim_id,
                props={"created_at": datetime.utcnow().isoformat()},
            )

    async def get_project_graph(self, project_id: str) -> dict[str, Any]:
        """Get the full knowledge graph for a project including all relationships."""
        driver = await self._get_driver()
        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (proj:Project {id: $project_id})
                OPTIONAL MATCH (proj)-[:HAS_PROBLEM]->(prob:Problem)
                OPTIONAL MATCH (prob)-[addr:ADDRESSED_BY]->(paper:Paper)
                OPTIONAL MATCH (proj)-[:HAS_APPROACH]->(app:Approach)
                OPTIONAL MATCH (app)-[:USES_TECHNIQUE]->(method:Method)
                OPTIONAL MATCH (app)-[:BASED_ON_CLAIM]->(claim:Claim)
                RETURN proj,
                    collect(DISTINCT prob) as problems,
                    collect(DISTINCT {problem: prob.id, paper: paper, relevance: addr.relevance}) as paper_links,
                    collect(DISTINCT app) as approaches,
                    collect(DISTINCT {approach: app.id, method: method}) as method_links,
                    collect(DISTINCT {approach: app.id, claim: claim}) as claim_links
                """,
                project_id=project_id,
            )
            record = await result.single()

            if not record:
                return {"nodes": [], "edges": []}

            nodes = []
            edges = []

            # Add project node
            proj = record["proj"]
            if proj:
                nodes.append(
                    {
                        "id": proj["id"],
                        "type": "project",
                        "label": proj.get("name", "Project"),
                        "data": dict(proj),
                    }
                )

            # Add problem nodes
            for prob in record["problems"]:
                if prob:
                    nodes.append(
                        {
                            "id": prob["id"],
                            "type": "problem",
                            "label": prob.get("category", "Problem"),
                            "data": dict(prob),
                        }
                    )
                    edges.append(
                        {
                            "source": project_id,
                            "target": prob["id"],
                            "type": "HAS_PROBLEM",
                        }
                    )

            # Add paper links
            for link in record["paper_links"]:
                if link.get("paper"):
                    paper = link["paper"]
                    if not any(n["id"] == paper["id"] for n in nodes):
                        nodes.append(
                            {
                                "id": paper["id"],
                                "type": "paper",
                                "label": paper.get("title", "Paper")[:50],
                                "data": dict(paper),
                            }
                        )
                    if link.get("problem"):
                        edges.append(
                            {
                                "source": link["problem"],
                                "target": paper["id"],
                                "type": "ADDRESSED_BY",
                                "relevance": link.get("relevance", 0.5),
                            }
                        )

            # Add approach nodes
            for app in record["approaches"]:
                if app:
                    nodes.append(
                        {
                            "id": app["id"],
                            "type": "approach",
                            "label": app.get("name", "Approach"),
                            "data": dict(app),
                        }
                    )
                    edges.append(
                        {
                            "source": project_id,
                            "target": app["id"],
                            "type": "HAS_APPROACH",
                        }
                    )

            # Add method links
            for link in record["method_links"]:
                if link.get("method"):
                    method = link["method"]
                    if not any(n["id"] == method["id"] for n in nodes):
                        nodes.append(
                            {
                                "id": method["id"],
                                "type": "method",
                                "label": method.get("name", "Method"),
                                "data": dict(method),
                            }
                        )
                    if link.get("approach"):
                        edges.append(
                            {
                                "source": link["approach"],
                                "target": method["id"],
                                "type": "USES_TECHNIQUE",
                            }
                        )

            # Add claim links
            for link in record["claim_links"]:
                if link.get("claim"):
                    claim = link["claim"]
                    if not any(n["id"] == claim["id"] for n in nodes):
                        nodes.append(
                            {
                                "id": claim["id"],
                                "type": "claim",
                                "label": claim.get("statement", "Claim")[:50],
                                "data": dict(claim),
                            }
                        )
                    if link.get("approach"):
                        edges.append(
                            {
                                "source": link["approach"],
                                "target": claim["id"],
                                "type": "BASED_ON_CLAIM",
                            }
                        )

            return {"nodes": nodes, "edges": edges}

    def _record_to_project(self, record: dict) -> ProjectNode:
        return ProjectNode(
            id=record.get("id", ""),
            name=record.get("name", ""),
            url=record.get("url", ""),
            source=record.get("source", "custom"),
            description=record.get("description", ""),
            status=record.get("status", "pending"),
            raw_content=record.get("raw_content"),
            error_message=record.get("error_message"),
            created_at=self._parse_datetime(record.get("created_at")) or datetime.utcnow(),
        )

    def _record_to_problem(self, record: dict) -> ProblemNode:
        return ProblemNode(
            id=record.get("id", ""),
            project_id=record.get("project_id", ""),
            statement=record.get("statement", ""),
            category=record.get("category", ""),
            details=record.get("details", ""),
            priority=record.get("priority", 1),
            created_at=self._parse_datetime(record.get("created_at")) or datetime.utcnow(),
        )

    def _record_to_approach(self, record: dict) -> ApproachNode:
        return ApproachNode(
            id=record.get("id", ""),
            project_id=record.get("project_id", ""),
            name=record.get("name", ""),
            description=record.get("description", ""),
            priority=record.get("priority", 1),
            confidence=record.get("confidence", 0.5),
            reasoning=record.get("reasoning"),
            challenges=record.get("challenges", []),
            mitigations=record.get("mitigations", []),
            created_at=self._parse_datetime(record.get("created_at")) or datetime.utcnow(),
        )


# Singleton instance
_kg: KnowledgeGraph | None = None


async def get_knowledge_graph(timeout: float = 10.0) -> KnowledgeGraph:
    """Get or create knowledge graph singleton."""
    global _kg
    if _kg is None:
        _kg = KnowledgeGraph()
        try:
            await asyncio.wait_for(_kg.setup_schema(), timeout=timeout)
        except TimeoutError as e:
            _kg = None
            raise TimeoutError(f"Knowledge graph setup timed out after {timeout}s") from e
    return _kg
