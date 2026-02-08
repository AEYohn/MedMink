"""Agent implementations for the Research Synthesizer."""

from src.agents.base import BaseAgent, AgentResult
from src.agents.ingest import IngestAgent
from src.agents.analyze import AnalyzeAgent
from src.agents.synthesize import SynthesizeAgent
from src.agents.correct import CorrectionAgent
from src.agents.project_analyzer import ProjectAnalyzerAgent
from src.agents.patterns import PatternAgent

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
