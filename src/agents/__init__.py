"""Agent implementations for the Research Synthesizer."""

from src.agents.base import BaseAgent, AgentResult

# Lazy imports — other agents pull in heavy deps (neo4j, google.generativeai)
# that aren't needed in lightweight contexts like case analysis.


def __getattr__(name: str):
    """Lazy-load agent classes on first access."""
    _lazy_map = {
        "IngestAgent": "src.agents.ingest",
        "AnalyzeAgent": "src.agents.analyze",
        "SynthesizeAgent": "src.agents.synthesize",
        "CorrectionAgent": "src.agents.correct",
        "ProjectAnalyzerAgent": "src.agents.project_analyzer",
        "PatternAgent": "src.agents.patterns",
    }
    if name in _lazy_map:
        import importlib
        module = importlib.import_module(_lazy_map[name])
        return getattr(module, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "BaseAgent",
    "AgentResult",
    "IngestAgent",
    "AnalyzeAgent",
    "SynthesizeAgent",
    "CorrectionAgent",
    "ProjectAnalyzerAgent",
    "PatternAgent",
]
