"""Pattern extraction agent for identifying recurring research patterns."""

from datetime import datetime
from typing import Any
from uuid import uuid4

import structlog

from src.agents.base import AgentResult, BaseAgent
from src.kg.models import PatternNode
from src.models import Task

logger = structlog.get_logger()


class PatternAgent(BaseAgent):
    """Agent for extracting and managing research patterns.

    Patterns are reusable research templates that appear across multiple papers,
    e.g., "contrastive learning for X", "transformer-based Y", "self-supervised Z".

    Inspired by Idea2Paper's pattern-based knowledge graph.
    """

    name = "patterns"

    async def execute(self, task: Task) -> AgentResult:
        """Execute pattern extraction or analysis."""
        try:
            payload = task.payload or {}
            action = payload.get("action", "extract")

            if action == "extract":
                return await self._extract_patterns(task)
            elif action == "cluster":
                return await self._cluster_patterns(task)
            elif action == "analyze":
                return await self._analyze_pattern_usage(task)
            else:
                return AgentResult(
                    success=False,
                    data={"error": f"Unknown action: {action}"},
                )

        except Exception as e:
            return await self._handle_error(e, task, {})

    async def _extract_patterns(self, task: Task) -> AgentResult:
        """Extract patterns from recent papers and techniques."""
        payload = task.payload or {}
        limit = payload.get("limit", 50)

        kg = await self._get_kg()
        gemini = await self._get_gemini()

        # Get recent techniques and papers
        techniques = await kg.get_techniques(limit=limit)
        papers = await kg.get_recent_papers(limit=limit)

        if not techniques and not papers:
            return AgentResult(
                success=True,
                data={"message": "No data available for pattern extraction"},
                metrics={"patterns_extracted": 0},
            )

        # Build context for pattern extraction
        context = "TECHNIQUES IN KNOWLEDGE GRAPH:\n"
        for tech in techniques[:30]:
            context += f"- {tech.name} ({tech.technique_type}): {tech.description[:100]}\n"

        context += "\n\nRECENT PAPERS:\n"
        for paper in papers[:20]:
            context += f"- {paper.title[:80]}\n"

        # Extract patterns using Gemini
        prompt = f"""Analyze these research techniques and papers to identify RECURRING RESEARCH PATTERNS.

A pattern is a reusable research template that appears across multiple papers, such as:
- "Contrastive learning for [domain]" - applies contrastive objectives to new domains
- "Transformer-based [task]" - uses transformer architecture for various tasks
- "Self-supervised pre-training + fine-tuning" - pre-train then adapt paradigm
- "Knowledge distillation from [large model] to [small model]" - model compression pattern

{context}

Identify 5-10 distinct patterns. For each pattern, provide:

{{
  "patterns": [
    {{
      "name": "Pattern name (e.g., 'Contrastive Learning for Vision')",
      "pattern_type": "methodology|architecture|training|data|evaluation",
      "template": "Abstract template (e.g., 'Apply contrastive learning to {{domain}} by {{approach}}')",
      "description": "Detailed description of the pattern",
      "key_components": ["component1", "component2"],
      "common_techniques": ["technique1", "technique2"],
      "example_applications": ["example1", "example2"],
      "domains": ["vision", "nlp", "etc"],
      "effectiveness_score": 0.8
    }}
  ]
}}

Focus on patterns that:
1. Appear across multiple techniques/papers
2. Are actionable (can be applied to new problems)
3. Represent proven research approaches"""

        result = await gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="extract_patterns",
            max_output_tokens=4096,
        )

        content = result.get("content", {})
        if isinstance(content, str):
            content = {}

        patterns_data = content.get("patterns", [])
        patterns_added = 0

        for pattern_data in patterns_data:
            if not pattern_data.get("name"):
                continue

            pattern = PatternNode(
                id=str(uuid4()),
                name=pattern_data.get("name", ""),
                pattern_type=pattern_data.get("pattern_type", "methodology"),
                template=pattern_data.get("template", ""),
                description=pattern_data.get("description", ""),
                key_components=pattern_data.get("key_components", []),
                common_techniques=pattern_data.get("common_techniques", []),
                example_applications=pattern_data.get("example_applications", []),
                domains=pattern_data.get("domains", []),
                frequency=1,
                effectiveness_score=pattern_data.get("effectiveness_score", 0.5),
                created_at=datetime.utcnow(),
            )

            await kg.add_pattern(pattern)
            patterns_added += 1

        thought = await self.create_thought_signature(
            task=task,
            context_summary=f"Analyzed {len(techniques)} techniques and {len(papers)} papers",
            decision_made=f"Extracted {patterns_added} research patterns",
            reasoning="Used Gemini to identify recurring patterns across research",
            confidence=0.8,
            assumptions=[
                "Patterns identified from current data represent real trends",
                "Patterns can be applied to new research problems",
            ],
            expected_outcomes=[
                "Patterns can guide future research directions",
                "New papers can be matched to existing patterns",
            ],
        )

        self.logger.info(
            "Pattern extraction complete",
            techniques_analyzed=len(techniques),
            papers_analyzed=len(papers),
            patterns_extracted=patterns_added,
        )

        return AgentResult(
            success=True,
            data={
                "patterns_extracted": patterns_added,
                "techniques_analyzed": len(techniques),
                "papers_analyzed": len(papers),
            },
            thought_signature=thought,
            metrics={
                "patterns_extracted": patterns_added,
            },
        )

    async def _cluster_patterns(self, task: Task) -> AgentResult:
        """Cluster similar patterns together."""
        kg = await self._get_kg()
        gemini = await self._get_gemini()

        patterns = await kg.get_patterns(limit=100)

        if len(patterns) < 2:
            return AgentResult(
                success=True,
                data={"message": "Not enough patterns for clustering"},
            )

        # Build pattern list for clustering
        pattern_list = "\n".join(
            [f"{i+1}. {p.name}: {p.description[:100]}" for i, p in enumerate(patterns)]
        )

        prompt = f"""Analyze these research patterns and identify which ones are related or could be merged.

PATTERNS:
{pattern_list}

Identify clusters of related patterns. For each cluster:
1. Which pattern indices belong together?
2. What is the overarching theme?
3. Should any patterns be merged?

Respond with JSON:
{{
  "clusters": [
    {{
      "pattern_indices": [1, 3, 5],
      "theme": "Self-supervised learning approaches",
      "should_merge": false,
      "merge_reason": ""
    }}
  ],
  "orphans": [2, 7],
  "analysis": "Overall pattern landscape analysis"
}}"""

        result = await gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="cluster_patterns",
            max_output_tokens=2048,
        )

        content = result.get("content", {})

        return AgentResult(
            success=True,
            data={
                "clusters": content.get("clusters", []),
                "orphans": content.get("orphans", []),
                "analysis": content.get("analysis", ""),
                "total_patterns": len(patterns),
            },
        )

    async def _analyze_pattern_usage(self, task: Task) -> AgentResult:
        """Analyze how patterns are used across papers."""
        payload = task.payload or {}
        pattern_id = payload.get("pattern_id")

        kg = await self._get_kg()
        gemini = await self._get_gemini()

        if pattern_id:
            patterns = [await kg.get_pattern(pattern_id)]
            patterns = [p for p in patterns if p]
        else:
            patterns = await kg.get_patterns(limit=10)

        if not patterns:
            return AgentResult(
                success=True,
                data={"message": "No patterns found"},
            )

        results = []
        for pattern in patterns:
            # Find papers that follow this pattern
            papers = await kg.get_papers_by_pattern(pattern.id, limit=20)

            # Analyze usage
            prompt = f"""Analyze how this research pattern is being used.

PATTERN: {pattern.name}
Template: {pattern.template}
Description: {pattern.description}

PAPERS USING THIS PATTERN:
{chr(10).join([f"- {p.title}" for p in papers[:10]])}

Analyze:
1. How widely is this pattern adopted?
2. What variations exist in its application?
3. Is it gaining or losing popularity?
4. What domains is it most successful in?

Respond with JSON:
{{
  "adoption_level": "high|medium|low",
  "trend": "rising|stable|declining",
  "variations": ["variation1", "variation2"],
  "success_domains": ["domain1", "domain2"],
  "future_outlook": "Brief prediction"
}}"""

            analysis = await gemini.generate(
                prompt=prompt,
                schema={"type": "object"},
                operation="analyze_pattern_usage",
                max_output_tokens=1024,
            )

            results.append(
                {
                    "pattern_id": pattern.id,
                    "pattern_name": pattern.name,
                    "paper_count": len(papers),
                    "analysis": analysis.get("content", {}),
                }
            )

        return AgentResult(
            success=True,
            data={
                "patterns_analyzed": len(results),
                "results": results,
            },
        )

    async def match_paper_to_patterns(
        self,
        title: str,
        abstract: str,
        techniques: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """Match a paper to existing patterns.

        Args:
            title: Paper title
            abstract: Paper abstract
            techniques: Optional list of techniques from the paper

        Returns:
            List of matching patterns with scores
        """
        kg = await self._get_kg()
        gemini = await self._get_gemini()

        patterns = await kg.get_patterns(limit=50)

        if not patterns:
            return []

        pattern_list = "\n".join(
            [f"{i+1}. {p.name} ({p.pattern_type}): {p.template}" for i, p in enumerate(patterns)]
        )

        techniques_text = ""
        if techniques:
            techniques_text = "\nTECHNIQUES USED:\n" + "\n".join(
                [f"- {t.get('name', '')}: {t.get('description', '')[:50]}" for t in techniques[:10]]
            )

        prompt = f"""Match this paper to research patterns.

PAPER:
Title: {title}
Abstract: {abstract}
{techniques_text}

AVAILABLE PATTERNS:
{pattern_list}

Which patterns does this paper follow? Rate each matching pattern:

Respond with JSON:
{{
  "matches": [
    {{
      "pattern_index": 1,
      "adherence_score": 0.85,
      "explanation": "Why this paper follows this pattern"
    }}
  ]
}}

Only include patterns with adherence_score >= 0.5"""

        result = await gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="match_patterns",
            max_output_tokens=1024,
        )

        content = result.get("content", {})
        matches = content.get("matches", [])

        # Map indices back to patterns
        matched_patterns = []
        for match in matches:
            idx = match.get("pattern_index", 0) - 1
            if 0 <= idx < len(patterns):
                matched_patterns.append(
                    {
                        "pattern_id": patterns[idx].id,
                        "pattern_name": patterns[idx].name,
                        "pattern_type": patterns[idx].pattern_type,
                        "adherence_score": match.get("adherence_score", 0.5),
                        "explanation": match.get("explanation", ""),
                    }
                )

        return matched_patterns
