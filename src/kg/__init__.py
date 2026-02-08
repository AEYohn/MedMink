"""Knowledge Graph module for Neo4j operations."""

from src.kg.graph import KnowledgeGraph, get_knowledge_graph
from src.kg.models import (
    PaperNode,
    ClaimNode,
    MethodNode,
    TrendNode,
    PredictionNode,
    ContainsRelation,
    SupportsRelation,
    ContradictsRelation,
    UsesMethodRelation,
    InvolvesTrendRelation,
)

__all__ = [
    "KnowledgeGraph",
    "get_knowledge_graph",
    "PaperNode",
    "ClaimNode",
    "MethodNode",
    "TrendNode",
    "PredictionNode",
    "ContainsRelation",
    "SupportsRelation",
    "ContradictsRelation",
    "UsesMethodRelation",
    "InvolvesTrendRelation",
]
