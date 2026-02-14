"""Project Analyzer agent for analyzing project/competition URLs and building solution approaches."""

import asyncio
from datetime import datetime
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import httpx
import structlog
from bs4 import BeautifulSoup

from src.agents.base import AgentResult, BaseAgent
from src.kg.models import ApproachNode, PaperNode, ProblemNode, ProjectNode
from src.models import Task

logger = structlog.get_logger()


class ProjectAnalyzerAgent(BaseAgent):
    """Agent for analyzing project URLs and building solution knowledge graphs."""

    name = "project_analyzer"

    async def execute(self, task: Task) -> AgentResult:
        """Execute project analysis."""
        try:
            payload = task.payload or {}
            project_id = payload.get("project_id")
            url = payload.get("url")
            name = payload.get("name")

            if not url and not project_id:
                return AgentResult(
                    success=False,
                    error="Either 'url' or 'project_id' must be provided",
                )

            kg = await self._get_kg()
            gemini = await self._get_gemini()

            # If project_id is provided, get existing project
            if project_id:
                project = await kg.get_project(project_id)
                if not project:
                    return AgentResult(
                        success=False,
                        error=f"Project not found: {project_id}",
                    )
                url = project.url
            else:
                # Create new project
                source = self._detect_source(url)
                project = ProjectNode(
                    id=str(uuid4()),
                    name=name or self._extract_name_from_url(url),
                    url=url,
                    source=source,
                    status="analyzing",
                    created_at=datetime.utcnow(),
                )
                await kg.add_project(project)

            self.logger.info("Starting project analysis", project_id=project.id, url=url)

            # Update status to analyzing
            await kg.update_project_status(project.id, "analyzing")

            try:
                # Step 1: Fetch and parse the project page
                raw_content = await self._fetch_project_page(url)
                project.raw_content = raw_content[:50000]  # Limit storage
                await kg.add_project(project)

                # Step 2: Parse problem structure using Gemini
                problem_breakdown = await self._parse_problem(gemini, raw_content, url)

                # Step 3: Store problem nodes
                problems_added = 0
                for problem_data in problem_breakdown.get("problems", []):
                    problem = ProblemNode(
                        id=str(uuid4()),
                        project_id=project.id,
                        statement=problem_data.get("statement", ""),
                        category=problem_data.get("category", "objective"),
                        details=problem_data.get("details", ""),
                        priority=problem_data.get("priority", 1),
                        created_at=datetime.utcnow(),
                    )
                    await kg.add_problem(problem, project.id)
                    problems_added += 1

                # Step 4: Search for relevant papers
                search_queries = problem_breakdown.get("search_queries", [])
                if not search_queries:
                    # Generate default queries from domains
                    domains = problem_breakdown.get("key_domains", [])
                    search_queries = domains[:5]

                papers = await self._search_relevant_papers(gemini, kg, search_queries)

                # Step 5: Analyze papers for relevance to the problem
                papers_linked = 0
                if papers:
                    paper_relevance = await self._analyze_papers_for_project(
                        gemini,
                        problem_breakdown,
                        papers,
                    )

                    # Link papers to problems
                    problems = await kg.get_problems_for_project(project.id)
                    for paper_rel in paper_relevance.get("paper_relevance", []):
                        paper_id = paper_rel.get("paper_id")
                        if not paper_id:
                            continue

                        relevance = paper_rel.get("relevance", 0.5)
                        if relevance < 0.3:  # Skip low relevance
                            continue

                        # Link to most relevant problem
                        aspects = paper_rel.get("aspects_addressed", [])
                        explanation = paper_rel.get("explanation", "")

                        for problem in problems:
                            if any(aspect.lower() in problem.category.lower() or
                                   aspect.lower() in problem.statement.lower()
                                   for aspect in aspects):
                                await kg.link_paper_to_problem(
                                    paper_id=paper_id,
                                    problem_id=problem.id,
                                    relevance=relevance,
                                    explanation=explanation,
                                    aspects_addressed=aspects,
                                )
                                papers_linked += 1
                                break

                # Step 6: Build solution approaches
                synthesis = await self._synthesize_approach(
                    gemini,
                    problem_breakdown,
                    papers,
                    paper_relevance if papers else {},
                )

                # Store approaches
                approaches_added = 0
                for approach_data in synthesis.get("approaches", []):
                    approach = ApproachNode(
                        id=str(uuid4()),
                        project_id=project.id,
                        name=approach_data.get("name", ""),
                        description=approach_data.get("description", ""),
                        priority=approach_data.get("priority", 1),
                        confidence=approach_data.get("confidence", 0.5),
                        reasoning=approach_data.get("reasoning"),
                        challenges=approach_data.get("challenges", []),
                        mitigations=approach_data.get("mitigations", []),
                        created_at=datetime.utcnow(),
                    )
                    await kg.add_approach(approach, project.id)
                    approaches_added += 1

                    # Link approach to methods mentioned
                    for technique in approach_data.get("techniques", []):
                        # Try to find existing method
                        methods = await kg.get_popular_methods(limit=100)
                        for method in methods:
                            if technique.lower() in method.name.lower() or method.name.lower() in technique.lower():
                                await kg.link_approach_to_method(approach.id, method.id)
                                break

                # Update project status to completed
                await kg.update_project_status(project.id, "completed")

                # Update project description from analysis
                project.description = problem_breakdown.get("problem_statement", "")[:2000]
                await kg.add_project(project)

                # Create thought signature
                thought = await self.create_thought_signature(
                    task=task,
                    context_summary=f"Analyzed project '{project.name}' from {project.source}",
                    decision_made=f"Extracted {problems_added} problems, linked {papers_linked} papers, created {approaches_added} approaches",
                    reasoning="Used Gemini to parse problem structure, searched arXiv for relevant papers, and synthesized solution approaches",
                    confidence=0.75,
                    assumptions=[
                        "Project page contains sufficient problem description",
                        "ArXiv papers are relevant to the problem domain",
                        "Gemini correctly identifies solution techniques",
                    ],
                    expected_outcomes=[
                        "Knowledge graph captures problem-solution relationships",
                        "Approaches provide actionable starting points",
                        "Related papers inform solution design",
                    ],
                )

                return AgentResult(
                    success=True,
                    data={
                        "project_id": project.id,
                        "project_name": project.name,
                        "problems_extracted": problems_added,
                        "papers_found": len(papers) if papers else 0,
                        "papers_linked": papers_linked,
                        "approaches_created": approaches_added,
                        "problem_breakdown": problem_breakdown,
                        "synthesis": synthesis,
                    },
                    thought_signature=thought,
                    metrics={
                        "problems_extracted": problems_added,
                        "papers_found": len(papers) if papers else 0,
                        "papers_linked": papers_linked,
                        "approaches_created": approaches_added,
                    },
                )

            except Exception as e:
                # Update project status to failed
                await kg.update_project_status(project.id, "failed", str(e))
                raise

        except Exception as e:
            return await self._handle_error(e, task, {"url": task.payload.get("url")})

    def _detect_source(self, url: str) -> str:
        """Detect the source type from URL."""
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        if "kaggle.com" in domain:
            return "kaggle"
        elif "github.com" in domain:
            return "github"
        else:
            return "custom"

    def _extract_name_from_url(self, url: str) -> str:
        """Extract a readable name from URL."""
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split("/") if p]

        if "kaggle.com" in parsed.netloc:
            # For Kaggle: /competitions/competition-name
            if len(path_parts) >= 2 and path_parts[0] == "competitions":
                return path_parts[1].replace("-", " ").title()
        elif "github.com" in parsed.netloc:
            # For GitHub: /owner/repo
            if len(path_parts) >= 2:
                return f"{path_parts[0]}/{path_parts[1]}"

        # Default: use last path component
        if path_parts:
            return path_parts[-1].replace("-", " ").replace("_", " ").title()
        return "Unnamed Project"

    async def _fetch_project_page(self, url: str) -> str:
        """Fetch the content of a project page."""
        self.logger.debug("Fetching project page", url=url)

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; ResearchSynthesizer/1.0)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            if "text/html" in content_type:
                # Parse HTML and extract text
                soup = BeautifulSoup(response.text, "html.parser")

                # Remove script and style elements
                for element in soup(["script", "style", "nav", "footer", "header"]):
                    element.decompose()

                # Get text content
                text = soup.get_text(separator="\n", strip=True)

                # Clean up excessive whitespace
                lines = [line.strip() for line in text.split("\n") if line.strip()]
                text = "\n".join(lines)

                return text
            else:
                # For non-HTML content (like GitHub README)
                return response.text

    async def _parse_problem(
        self,
        gemini,
        raw_content: str,
        url: str,
    ) -> dict[str, Any]:
        """Parse the problem structure from page content using Gemini."""
        self.logger.debug("Parsing problem structure")

        prompt = f"""Analyze this project/competition page and extract structured problem information.

URL: {url}

Page Content:
{raw_content[:15000]}

Extract and return a JSON object with:
{{
    "problem_statement": "A clear, concise statement of the main problem to solve",
    "problems": [
        {{
            "statement": "Specific problem component",
            "category": "one of: objective, input, output, constraint, metric, domain",
            "details": "Additional details and context",
            "priority": 1-5 (5 being most important)
        }}
    ],
    "input_data": {{
        "description": "What data is provided",
        "format": "Data format details",
        "size": "Approximate size if mentioned"
    }},
    "output_format": {{
        "description": "What should be produced",
        "format": "Expected output format"
    }},
    "evaluation_metric": {{
        "name": "Metric name (e.g., RMSE, AUC, F1)",
        "description": "How success is measured"
    }},
    "constraints": [
        "List of constraints (time, compute, rules)"
    ],
    "key_domains": [
        "Relevant research domains (e.g., computer vision, NLP, time series)"
    ],
    "search_queries": [
        "Suggested arXiv search queries to find relevant papers"
    ]
}}

Be thorough but precise. Focus on extracting actionable problem components."""

        result = await gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="parse_problem",
        )

        content = result["content"]
        if isinstance(content, str):
            import json
            import re
            # Strip markdown code blocks if present
            content_str = content.strip()
            if content_str.startswith("```"):
                # Remove opening ```json or ```
                content_str = re.sub(r'^```(?:json)?\s*\n?', '', content_str)
                # Remove closing ```
                content_str = re.sub(r'\n?```\s*$', '', content_str)
            try:
                content = json.loads(content_str)
            except json.JSONDecodeError:
                content = {"problem_statement": content, "problems": [], "key_domains": []}

        return content

    async def _search_relevant_papers(
        self,
        gemini,
        kg,
        search_queries: list[str],
    ) -> list[PaperNode]:
        """Search for relevant papers based on problem analysis."""
        self.logger.debug("Searching for relevant papers", queries=search_queries)

        # First, try to find papers already in the knowledge graph
        all_papers = []
        existing_papers = []

        try:
            # Get papers from KG that might be relevant
            for query in search_queries[:3]:
                # Search by looking at existing papers
                papers = await kg.get_unanalyzed_papers(limit=20)
                for paper in papers:
                    if any(term.lower() in paper.title.lower() or term.lower() in paper.abstract.lower()
                           for term in query.split()):
                        if paper.id not in [p.id for p in existing_papers]:
                            existing_papers.append(paper)

            all_papers.extend(existing_papers[:20])

            # Also search arXiv for new papers (using the ingest agent's arxiv client pattern)
            try:
                import arxiv

                for query in search_queries[:3]:
                    search = arxiv.Search(
                        query=query,
                        max_results=10,
                        sort_by=arxiv.SortCriterion.Relevance,
                    )

                    async def fetch_arxiv(search=search):
                        papers = []
                        for result in search.results():
                            paper = PaperNode(
                                id=str(uuid4()),
                                arxiv_id=result.entry_id.split("/")[-1],
                                title=result.title,
                                abstract=result.summary,
                                authors=[a.name for a in result.authors],
                                categories=list(result.categories),
                                published_date=result.published,
                                pdf_url=result.pdf_url,
                                source_url=result.entry_id,
                                created_at=datetime.utcnow(),
                            )

                            # Add to KG if not exists
                            existing = await kg.get_paper_by_arxiv_id(paper.arxiv_id)
                            if not existing:
                                await kg.add_paper(paper)
                                papers.append(paper)
                            else:
                                papers.append(existing)

                            if len(papers) >= 10:
                                break
                        return papers

                    arxiv_papers = await asyncio.to_thread(lambda: asyncio.run(fetch_arxiv()))
                    for p in arxiv_papers:
                        if p.id not in [paper.id for paper in all_papers]:
                            all_papers.append(p)

            except ImportError:
                self.logger.warning("arxiv package not available, using only existing papers")
            except Exception as e:
                self.logger.warning("ArXiv search failed", error=str(e))

        except Exception as e:
            self.logger.warning("Paper search failed", error=str(e))

        self.logger.info("Found relevant papers", count=len(all_papers))
        return all_papers[:30]  # Limit to 30 papers

    async def _analyze_papers_for_project(
        self,
        gemini,
        problem_breakdown: dict[str, Any],
        papers: list[PaperNode],
    ) -> dict[str, Any]:
        """Analyze papers for relevance to the project problem."""
        self.logger.debug("Analyzing paper relevance", paper_count=len(papers))

        problem_summary = problem_breakdown.get("problem_statement", "")
        key_domains = problem_breakdown.get("key_domains", [])

        papers_text = "\n\n".join([
            f"PAPER {i+1} (ID: {p.id}):\nTitle: {p.title}\nAbstract: {p.abstract[:500]}"
            for i, p in enumerate(papers[:15])
        ])

        prompt = f"""Given this problem and these papers, rate each paper's relevance.

PROBLEM:
{problem_summary}

KEY DOMAINS: {', '.join(key_domains)}

PAPERS:
{papers_text}

For each paper, provide:
{{
    "paper_relevance": [
        {{
            "paper_id": "the paper ID",
            "relevance": 0.0-1.0,
            "explanation": "Why this paper is relevant",
            "aspects_addressed": ["which problem aspects this addresses"],
            "techniques": ["useful techniques from this paper"]
        }}
    ]
}}

Be selective - only rate papers that are genuinely relevant to solving this problem."""

        result = await gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="analyze_paper_relevance",
        )

        content = result["content"]
        if isinstance(content, str):
            import json
            import re
            content_str = content.strip()
            if content_str.startswith("```"):
                content_str = re.sub(r'^```(?:json)?\s*\n?', '', content_str)
                content_str = re.sub(r'\n?```\s*$', '', content_str)
            try:
                content = json.loads(content_str)
            except json.JSONDecodeError:
                content = {"paper_relevance": []}

        return content

    async def _synthesize_approach(
        self,
        gemini,
        problem_breakdown: dict[str, Any],
        papers: list[PaperNode],
        paper_relevance: dict[str, Any],
    ) -> dict[str, Any]:
        """Synthesize solution approaches from problem and paper analysis."""
        self.logger.debug("Synthesizing solution approaches")

        problem_summary = problem_breakdown.get("problem_statement", "")
        problems = problem_breakdown.get("problems", [])
        constraints = problem_breakdown.get("constraints", [])
        metric = problem_breakdown.get("evaluation_metric", {})

        # Build paper claims summary
        relevant_papers = paper_relevance.get("paper_relevance", [])
        papers_summary = "\n".join([
            f"- {p.get('paper_id', 'unknown')}: Relevance {p.get('relevance', 0):.2f}, "
            f"Techniques: {', '.join(p.get('techniques', []))}"
            for p in relevant_papers if p.get("relevance", 0) > 0.3
        ])

        prompt = f"""Given this problem analysis and relevant research, synthesize solution approaches.

PROBLEM:
{problem_summary}

PROBLEM COMPONENTS:
{chr(10).join([f"- [{p.get('category', 'unknown')}] {p.get('statement', '')}" for p in problems])}

CONSTRAINTS:
{chr(10).join([f"- {c}" for c in constraints])}

EVALUATION METRIC:
{metric.get('name', 'Unknown')}: {metric.get('description', '')}

RELEVANT PAPERS AND TECHNIQUES:
{papers_summary if papers_summary else "No highly relevant papers found"}

Synthesize solution approaches:
{{
    "approaches": [
        {{
            "name": "Approach name",
            "description": "Detailed description of the approach",
            "priority": 1-5 (implementation priority, 5 = do first),
            "confidence": 0.0-1.0 (how confident this will work),
            "reasoning": "Why this approach makes sense",
            "techniques": ["specific techniques to use"],
            "challenges": ["potential challenges"],
            "mitigations": ["how to address challenges"]
        }}
    ],
    "implementation_order": ["ordered list of approach names"],
    "key_insights": ["important insights from the research"],
    "gaps": ["areas where more research might be needed"]
}}

Focus on practical, implementable approaches. Be specific about techniques."""

        result = await gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="synthesize_approach",
            max_output_tokens=8192,
        )

        content = result["content"]
        if isinstance(content, str):
            import json
            import re
            content_str = content.strip()
            if content_str.startswith("```"):
                content_str = re.sub(r'^```(?:json)?\s*\n?', '', content_str)
                content_str = re.sub(r'\n?```\s*$', '', content_str)
            try:
                content = json.loads(content_str)
            except json.JSONDecodeError:
                content = {"approaches": [], "implementation_order": [], "key_insights": [], "gaps": []}

        return content
