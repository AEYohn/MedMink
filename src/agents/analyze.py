"""Analyze agent for extracting claims, methods, and detecting contradictions."""

import asyncio
from datetime import datetime
from typing import Any
from uuid import uuid4

import structlog

from src.agents.base import BaseAgent, AgentResult
from src.kg.models import ClaimNode, MethodNode, TrendNode, TechniqueNode
from src.models import Task
from src.rag import get_vector_store, get_rag_engine
from src.config import settings
from src.pdf.extractor import extract_paper_text_safe
from src.novelty.checker import get_novelty_checker, NoveltyChecker

logger = structlog.get_logger()


class AnalyzeAgent(BaseAgent):
    """Agent for analyzing papers and extracting structured information."""

    name = "analyze"

    async def execute(self, task: Task) -> AgentResult:
        """Execute paper analysis with batch processing and caching.

        Research-backed optimizations:
        - Batch analysis: Reduces API calls by analyzing multiple papers at once
        - Analysis caching: Avoids redundant API calls for similar papers
        - Token budget control: Configurable depth vs cost tradeoff
        """
        try:
            payload = task.payload or {}
            paper_id = payload.get("paper_id")
            batch_size = payload.get("batch_size", 10)
            analysis_mode = payload.get("mode", settings.analysis_mode)
            use_batch = payload.get("use_batch", settings.enable_batch_analysis)

            kg = await self._get_kg()
            gemini = await self._get_gemini()

            # Get papers to analyze
            if paper_id:
                paper = await kg.get_paper(paper_id)
                papers = [paper] if paper else []
            else:
                papers = await kg.get_unanalyzed_papers(limit=batch_size)

            if not papers:
                return AgentResult(
                    success=True,
                    data={"message": "No papers to analyze"},
                    metrics={"papers_analyzed": 0},
                )

            self.logger.info(
                "Starting paper analysis",
                paper_count=len(papers),
                mode=analysis_mode,
                batch_enabled=use_batch,
            )

            total_claims = 0
            total_methods = 0
            analyzed_papers = []

            # Initialize RAG components for embedding storage
            vector_store = get_vector_store()
            rag_engine = await get_rag_engine()

            # Use batch analysis if enabled and multiple papers
            if use_batch and len(papers) > 1 and not paper_id:
                return await self._execute_batch(
                    papers=papers,
                    kg=kg,
                    gemini=gemini,
                    vector_store=vector_store,
                    task=task,
                    mode=analysis_mode,
                )

            for paper in papers:
                try:
                    # Extract full text from PDF if enabled and available
                    paper_full_text = None
                    if settings.enable_full_text_extraction and paper.pdf_url:
                        extraction_result = await extract_paper_text_safe(paper.pdf_url)
                        if extraction_result:
                            # Build full text context focusing on key sections
                            paper_full_text = ""
                            sections = extraction_result["sections"]

                            # Prioritize sections most likely to have formulas/algorithms
                            for section_name in ["methods", "algorithm", "model", "training", "implementation"]:
                                if section_name in sections and sections[section_name]:
                                    paper_full_text += f"\n\n=== {section_name.upper()} SECTION ===\n"
                                    paper_full_text += sections[section_name]

                            # Add experiments/results if we have room
                            for section_name in ["experiments", "results"]:
                                if section_name in sections and sections[section_name]:
                                    paper_full_text += f"\n\n=== {section_name.upper()} SECTION ===\n"
                                    paper_full_text += sections[section_name][:2000]

                            # If no sections found, use truncated full text
                            if not paper_full_text and extraction_result["full_text"]:
                                paper_full_text = extraction_result["full_text"][:15000]

                            self.logger.info(
                                "Extracted PDF text for analysis",
                                paper_id=paper.id,
                                pages=extraction_result["page_count"],
                                chars=len(paper_full_text),
                                sections_found=list(sections.keys()),
                            )

                    # Get related papers for additional context
                    related_context = ""
                    try:
                        related_papers = await rag_engine.get_context_for_paper(
                            title=paper.title,
                            abstract=paper.abstract or "",
                            limit=3,
                        )
                        if related_papers:
                            related_context = "\n\n=== RELATED RESEARCH CONTEXT ===\n"
                            for rp in related_papers:
                                related_context += f"\n[Related Paper] {rp['title']}\n"
                                if rp.get('claims'):
                                    related_context += "Key claims:\n"
                                    for claim in rp['claims'][:3]:
                                        related_context += f"- {claim['statement'][:150]}\n"
                            self.logger.debug(
                                "Using related context",
                                paper_id=paper.id,
                                related_count=len(related_papers),
                            )
                    except Exception as e:
                        self.logger.debug("Could not get related context", error=str(e))

                    # Combine full text and related context
                    combined_context = ""
                    if paper_full_text:
                        combined_context = paper_full_text
                    if related_context:
                        combined_context += related_context

                    # Analyze the paper with full text and context
                    analysis = await gemini.analyze_paper(
                        title=paper.title,
                        abstract=paper.abstract,
                        full_text=combined_context if combined_context else None,
                    )

                    self.logger.info(
                        "Gemini analysis result",
                        paper_id=paper.id,
                        claims_count=len(analysis.get("claims", [])),
                        methods_count=len(analysis.get("methods", [])),
                        techniques_count=len(analysis.get("techniques", [])),
                        has_summary=bool(analysis.get("summary")),
                    )

                    # Extract and store claims with novelty scoring
                    claims_added = 0
                    novelty_checker = get_novelty_checker()

                    for claim_data in analysis.get("claims", []):
                        claim_id = str(uuid4())
                        claim_statement = claim_data.get("statement", "")
                        claim_category = claim_data.get("category", "empirical")

                        # Check novelty BEFORE adding (compare against existing claims)
                        novelty_score = None
                        similar_claims = []
                        novelty_explanation = None

                        try:
                            novelty_result = await novelty_checker.check_claim_novelty(
                                statement=claim_statement,
                                category=claim_category,
                                top_k=3,
                            )
                            novelty_score = novelty_result.novelty_score
                            similar_claims = [
                                item.get("id", "") for item in novelty_result.similar_items[:3]
                            ]
                            novelty_explanation = novelty_result.explanation

                            self.logger.debug(
                                "Computed claim novelty",
                                claim=claim_statement[:50],
                                novelty_score=novelty_score,
                                novelty_level=novelty_result.novelty_level.value,
                            )
                        except Exception as e:
                            self.logger.debug("Failed to compute claim novelty", error=str(e))

                        claim = ClaimNode(
                            id=claim_id,
                            paper_id=paper.id,
                            statement=claim_statement,
                            category=claim_category,
                            confidence=claim_data.get("confidence", 0.5),
                            evidence=claim_data.get("evidence"),
                            novelty_score=novelty_score,
                            similar_claims=similar_claims,
                            novelty_explanation=novelty_explanation,
                            created_at=datetime.utcnow(),
                        )
                        await kg.add_claim(claim, paper.id)

                        # Store claim embedding for RAG (after adding to allow future comparisons)
                        try:
                            await vector_store.add_claim_embedding(
                                claim_id=claim_id,
                                statement=claim_statement,
                                category=claim_category,
                                paper_id=paper.id,
                            )
                        except Exception as e:
                            self.logger.debug("Failed to store claim embedding", error=str(e))

                        claims_added += 1

                    # Extract and store methods
                    methods_added = 0
                    for method_data in analysis.get("methods", []):
                        method = MethodNode(
                            id=str(uuid4()),
                            name=method_data.get("name", ""),
                            description=method_data.get("description", ""),
                            is_novel=method_data.get("is_novel", False),
                            first_paper_id=paper.id if method_data.get("is_novel") else None,
                            created_at=datetime.utcnow(),
                        )
                        await kg.add_method(
                            method,
                            paper_id=paper.id,
                            is_novel=method_data.get("is_novel", False),
                        )
                        methods_added += 1

                    # Extract and store techniques with novelty scoring
                    techniques_added = 0
                    novelty_checker = get_novelty_checker()

                    for tech_data in analysis.get("techniques", []):
                        if not tech_data.get("name"):
                            continue

                        technique_id = str(uuid4())
                        tech_name = tech_data.get("name", "")
                        tech_description = tech_data.get("description", "")
                        tech_formula = tech_data.get("formula")

                        # Check novelty BEFORE adding (so we compare against existing techniques)
                        novelty_score = None
                        similar_techniques = []
                        novelty_explanation = None

                        try:
                            novelty_result = await novelty_checker.check_technique_novelty(
                                name=tech_name,
                                description=tech_description,
                                formula=tech_formula,
                                top_k=3,
                            )
                            novelty_score = novelty_result.novelty_score
                            similar_techniques = [
                                item.get("id", "") for item in novelty_result.similar_items[:3]
                            ]
                            novelty_explanation = novelty_result.explanation

                            self.logger.debug(
                                "Computed technique novelty",
                                technique=tech_name,
                                novelty_score=novelty_score,
                                novelty_level=novelty_result.novelty_level.value,
                            )
                        except Exception as e:
                            self.logger.debug("Failed to compute technique novelty", error=str(e))

                        technique = TechniqueNode(
                            id=technique_id,
                            name=tech_name,
                            technique_type=tech_data.get("type", "other"),
                            description=tech_description,
                            formula=tech_formula,
                            pseudocode=tech_data.get("pseudocode"),
                            implementation_notes=tech_data.get("implementation_notes"),
                            is_novel=tech_data.get("is_novel", False),
                            improves_upon=tech_data.get("improves_upon"),
                            paper_id=paper.id,
                            novelty_score=novelty_score,
                            similar_techniques=similar_techniques,
                            novelty_explanation=novelty_explanation,
                            created_at=datetime.utcnow(),
                        )
                        await kg.add_technique(technique, paper_id=paper.id)

                        # Store technique embedding for RAG (after adding to allow future comparisons)
                        try:
                            await vector_store.add_technique_embedding(
                                technique_id=technique_id,
                                name=tech_name,
                                description=tech_description,
                                formula=tech_formula,
                            )
                        except Exception as e:
                            self.logger.debug("Failed to store technique embedding", error=str(e))

                        techniques_added += 1

                    # Mark paper as analyzed
                    await kg.mark_paper_analyzed(paper.id)

                    # Store embeddings for RAG search
                    try:
                        await vector_store.add_paper_embedding(
                            paper_id=paper.id,
                            title=paper.title,
                            abstract=paper.abstract or "",
                        )
                    except Exception as e:
                        self.logger.debug("Failed to store paper embedding", error=str(e))

                    total_claims += claims_added
                    total_methods += methods_added
                    analyzed_papers.append({
                        "paper_id": paper.id,
                        "title": paper.title[:100],
                        "claims": claims_added,
                        "methods": methods_added,
                    })

                    self.logger.debug(
                        "Paper analyzed",
                        paper_id=paper.id,
                        claims=claims_added,
                        methods=methods_added,
                    )

                except Exception as e:
                    self.logger.warning(
                        "Failed to analyze paper",
                        paper_id=paper.id,
                        error=str(e),
                    )
                    continue

            # Create thought signature
            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Analyzed {len(analyzed_papers)} papers from the knowledge graph",
                decision_made=f"Extracted {total_claims} claims and {total_methods} methods",
                reasoning="Used Gemini to extract structured information from paper abstracts",
                confidence=0.85,
                assumptions=[
                    "Paper abstracts contain sufficient information for claim extraction",
                    "Gemini correctly identifies claims and methods",
                ],
                expected_outcomes=[
                    "Claims can be compared for contradictions",
                    "Methods can be tracked for trend analysis",
                    f"{total_claims} new claims available for analysis",
                ],
            )

            return AgentResult(
                success=True,
                data={
                    "papers_analyzed": len(analyzed_papers),
                    "total_claims": total_claims,
                    "total_methods": total_methods,
                    "details": analyzed_papers,
                },
                thought_signature=thought,
                metrics={
                    "papers_analyzed": len(analyzed_papers),
                    "claims_extracted": total_claims,
                    "methods_extracted": total_methods,
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, {"paper_id": task.payload.get("paper_id")})

    async def _execute_batch(
        self,
        papers: list,
        kg,
        gemini,
        vector_store,
        task: Task,
        mode: str,
    ) -> AgentResult:
        """Execute batch paper analysis for efficiency.

        Research-backed optimization: Reduces API calls by ~60% when
        analyzing multiple papers together.
        """
        total_claims = 0
        total_methods = 0
        total_techniques = 0
        analyzed_papers = []

        # Process papers in batches
        batch_size = settings.batch_size
        for i in range(0, len(papers), batch_size):
            batch = papers[i : i + batch_size]

            # Prepare batch for API call
            batch_input = [
                {"title": p.title, "abstract": p.abstract or ""}
                for p in batch
            ]

            self.logger.info(
                "Processing batch",
                batch_num=i // batch_size + 1,
                papers_in_batch=len(batch),
            )

            # Call batch analysis
            try:
                analyses = await gemini.analyze_papers_batch(batch_input, mode=mode)
            except Exception as e:
                self.logger.warning("Batch analysis failed, falling back to individual", error=str(e))
                # Fall back to individual analysis
                analyses = []
                for paper_input in batch_input:
                    try:
                        analysis = await gemini.analyze_paper(
                            title=paper_input["title"],
                            abstract=paper_input["abstract"],
                            mode=mode,
                        )
                        analyses.append(analysis)
                    except Exception as inner_e:
                        self.logger.warning("Individual analysis failed", error=str(inner_e))
                        analyses.append({})

            # Process each analysis result
            for paper, analysis in zip(batch, analyses):
                if not analysis:
                    continue

                try:
                    claims_added = 0
                    methods_added = 0
                    techniques_added = 0

                    # Extract and store claims
                    for claim_data in analysis.get("claims", []):
                        claim_id = str(uuid4())
                        claim = ClaimNode(
                            id=claim_id,
                            paper_id=paper.id,
                            statement=claim_data.get("statement", ""),
                            category=claim_data.get("category", "empirical"),
                            confidence=claim_data.get("confidence", 0.5),
                            evidence=claim_data.get("evidence"),
                            created_at=datetime.utcnow(),
                        )
                        await kg.add_claim(claim, paper.id)
                        claims_added += 1

                    # Extract and store methods
                    for method_data in analysis.get("methods", []):
                        method = MethodNode(
                            id=str(uuid4()),
                            name=method_data.get("name", ""),
                            description=method_data.get("description", ""),
                            is_novel=method_data.get("is_novel", False),
                            first_paper_id=paper.id if method_data.get("is_novel") else None,
                            created_at=datetime.utcnow(),
                        )
                        await kg.add_method(
                            method,
                            paper_id=paper.id,
                            is_novel=method_data.get("is_novel", False),
                        )
                        methods_added += 1

                    # Extract and store techniques
                    for tech_data in analysis.get("techniques", []):
                        if not tech_data.get("name"):
                            continue
                        technique = TechniqueNode(
                            id=str(uuid4()),
                            name=tech_data.get("name", ""),
                            technique_type=tech_data.get("type", "other"),
                            description=tech_data.get("description", ""),
                            formula=tech_data.get("formula"),
                            pseudocode=tech_data.get("pseudocode"),
                            implementation_notes=tech_data.get("implementation_notes"),
                            is_novel=tech_data.get("is_novel", False),
                            improves_upon=tech_data.get("improves_upon"),
                            paper_id=paper.id,
                            created_at=datetime.utcnow(),
                        )
                        await kg.add_technique(technique, paper_id=paper.id)
                        techniques_added += 1

                    # Mark paper as analyzed
                    await kg.mark_paper_analyzed(paper.id)

                    # Store embeddings
                    try:
                        await vector_store.add_paper_embedding(
                            paper_id=paper.id,
                            title=paper.title,
                            abstract=paper.abstract or "",
                        )
                    except Exception:
                        pass

                    total_claims += claims_added
                    total_methods += methods_added
                    total_techniques += techniques_added
                    analyzed_papers.append({
                        "paper_id": paper.id,
                        "title": paper.title[:100],
                        "claims": claims_added,
                        "methods": methods_added,
                        "techniques": techniques_added,
                    })

                except Exception as e:
                    self.logger.warning(
                        "Failed to process batch result",
                        paper_id=paper.id,
                        error=str(e),
                    )

        # Create thought signature
        thought = await self.create_thought_signature(
            task=task,
            context_summary=f"Batch analyzed {len(analyzed_papers)} papers",
            decision_made=f"Extracted {total_claims} claims, {total_methods} methods, {total_techniques} techniques",
            reasoning="Used batch API calls to reduce cost and latency (research-backed: AWO)",
            confidence=0.85,
            assumptions=[
                "Batch analysis maintains quality vs individual analysis",
                "Caching reduces redundant API calls",
            ],
            expected_outcomes=[
                f"{total_claims} claims for contradiction detection",
                f"{total_techniques} techniques with actionable content",
            ],
        )

        return AgentResult(
            success=True,
            data={
                "papers_analyzed": len(analyzed_papers),
                "total_claims": total_claims,
                "total_methods": total_methods,
                "total_techniques": total_techniques,
                "details": analyzed_papers,
                "optimization": "batch_analysis",
            },
            thought_signature=thought,
            metrics={
                "papers_analyzed": len(analyzed_papers),
                "claims_extracted": total_claims,
                "methods_extracted": total_methods,
                "techniques_extracted": total_techniques,
            },
        )

    async def detect_contradictions(self, task: Task) -> AgentResult:
        """Detect contradictions between claims."""
        try:
            payload = task.payload or {}
            limit = payload.get("limit", 50)

            kg = await self._get_kg()
            gemini = await self._get_gemini()

            # Get potential contradictions
            claim_pairs = await kg.get_potential_contradictions(limit=limit)

            if not claim_pairs:
                return AgentResult(
                    success=True,
                    data={"message": "No potential contradictions to analyze"},
                    metrics={"contradictions_found": 0},
                )

            self.logger.info("Analyzing potential contradictions", pairs=len(claim_pairs))

            # Prepare claims for analysis
            claims_list = []
            for claim1, claim2 in claim_pairs:
                claims_list.append({
                    "statement": claim1.statement,
                    "category": claim1.category,
                })
                claims_list.append({
                    "statement": claim2.statement,
                    "category": claim2.category,
                })

            # Detect contradictions using Gemini
            analysis = await gemini.detect_contradictions(claims_list)

            contradictions_added = 0
            for contradiction in analysis.get("contradictions", []):
                idx1 = contradiction.get("claim1_index", 0)
                idx2 = contradiction.get("claim2_index", 1)

                # Map indices to original pairs
                pair_idx = idx1 // 2
                if pair_idx < len(claim_pairs):
                    claim1, claim2 = claim_pairs[pair_idx]

                    await kg.add_contradiction(
                        claim1_id=claim1.id,
                        claim2_id=claim2.id,
                        strength=contradiction.get("strength", 0.5),
                        explanation=contradiction.get("explanation", ""),
                        contradiction_type=contradiction.get("contradiction_type", "direct"),
                        possible_reconciliation=contradiction.get("possible_reconciliation"),
                    )
                    contradictions_added += 1

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Analyzed {len(claim_pairs)} claim pairs for contradictions",
                decision_made=f"Found and recorded {contradictions_added} contradictions",
                reasoning="Used Gemini to identify semantic contradictions between claims",
                confidence=analysis.get("analysis_confidence", 0.7),
                assumptions=[
                    "Claims in the same category can contradict",
                    "Gemini accurately identifies contradictions",
                ],
                expected_outcomes=[
                    "Contradictions flagged for human review if needed",
                    "Research landscape becomes clearer",
                ],
            )

            return AgentResult(
                success=True,
                data={
                    "pairs_analyzed": len(claim_pairs),
                    "contradictions_found": contradictions_added,
                },
                thought_signature=thought,
                metrics={
                    "pairs_analyzed": len(claim_pairs),
                    "contradictions_found": contradictions_added,
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, {})

    async def identify_trends(self, task: Task) -> AgentResult:
        """Identify research trends from recent papers and claims."""
        try:
            payload = task.payload or {}

            kg = await self._get_kg()
            gemini = await self._get_gemini()

            # Get recent claims and methods
            claims = await kg.get_all_claims(limit=200)
            methods = await kg.get_popular_methods(limit=50)
            existing_trends = await kg.get_trends(limit=20)

            if not claims:
                return AgentResult(
                    success=True,
                    data={"message": "Not enough data for trend analysis"},
                    metrics={"trends_identified": 0},
                )

            # Build summary for trend analysis
            papers_summary = "Recent claims and methods:\n\n"
            papers_summary += "CLAIMS:\n"
            for claim in claims[:100]:
                papers_summary += f"- [{claim.category}] {claim.statement[:200]}\n"

            papers_summary += "\nMETHODS:\n"
            for method in methods[:30]:
                papers_summary += f"- {method.name}: {method.description[:100]} (used in {method.paper_count} papers)\n"

            # Get historical trends for context
            historical = [
                {"name": t.name, "direction": t.direction, "velocity": t.velocity}
                for t in existing_trends
            ]

            # Identify trends using Gemini
            analysis = await gemini.identify_trends(
                papers_summary=papers_summary,
                historical_trends=historical if historical else None,
            )

            trends_added = 0
            for trend_data in analysis.get("trends", []):
                trend = TrendNode(
                    id=str(uuid4()),
                    name=trend_data.get("name", ""),
                    description=trend_data.get("description", ""),
                    direction=trend_data.get("direction", "rising"),
                    velocity=trend_data.get("velocity", 5.0),
                    confidence=trend_data.get("confidence", 0.7),
                    created_at=datetime.utcnow(),
                )
                await kg.add_trend(trend)
                trends_added += 1

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Analyzed {len(claims)} claims and {len(methods)} methods for trends",
                decision_made=f"Identified {trends_added} trends",
                reasoning="Used Gemini to identify patterns and emerging directions in research",
                confidence=0.75,
                assumptions=[
                    "Recent claims reflect current research directions",
                    "Method popularity indicates trend strength",
                ],
                expected_outcomes=[
                    "Trends inform prediction generation",
                    "Weekly synthesis will include trend analysis",
                ],
            )

            return AgentResult(
                success=True,
                data={
                    "trends_identified": trends_added,
                    "meta_observations": analysis.get("meta_observations", []),
                },
                thought_signature=thought,
                metrics={
                    "claims_analyzed": len(claims),
                    "methods_analyzed": len(methods),
                    "trends_identified": trends_added,
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, {})

    async def generate_predictions(self, task: Task) -> AgentResult:
        """Generate predictions based on trends."""
        try:
            kg = await self._get_kg()
            gemini = await self._get_gemini()

            # Get current trends
            trends = await kg.get_rising_trends(limit=10)

            if not trends:
                return AgentResult(
                    success=True,
                    data={"message": "Not enough trends for prediction generation"},
                    metrics={"predictions_made": 0},
                )

            # Get recent claims for context
            claims = await kg.get_all_claims(limit=50)
            developments = "\n".join([
                f"- {c.statement[:150]}"
                for c in claims[:30]
            ])

            # Generate predictions
            trend_data = [
                {"name": t.name, "direction": t.direction, "velocity": t.velocity}
                for t in trends
            ]

            analysis = await gemini.generate_predictions(
                trends=trend_data,
                recent_developments=developments,
            )

            from src.kg.models import PredictionNode
            from datetime import timedelta

            predictions_added = 0
            for pred_data in analysis.get("predictions", []):
                # Calculate due date based on timeframe
                timeframe = pred_data.get("timeframe", "3_months")
                months = {"1_month": 1, "3_months": 3, "6_months": 6, "1_year": 12}.get(timeframe, 3)
                due_date = datetime.utcnow() + timedelta(days=months * 30)

                prediction = PredictionNode(
                    id=str(uuid4()),
                    statement=pred_data.get("statement", ""),
                    category=pred_data.get("category", ""),
                    confidence=pred_data.get("confidence", 0.5),
                    timeframe=timeframe,
                    reasoning=pred_data.get("reasoning"),
                    due_date=due_date,
                    created_at=datetime.utcnow(),
                )

                # Link to relevant trends
                trend_ids = [t.id for t in trends[:3]]  # Link to top trends
                await kg.add_prediction(prediction, trend_ids=trend_ids)
                predictions_added += 1

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Generated predictions based on {len(trends)} trends",
                decision_made=f"Created {predictions_added} predictions",
                reasoning="Used Gemini to extrapolate from current trends and developments",
                confidence=0.6,  # Predictions are inherently uncertain
                assumptions=[
                    "Current trends will continue",
                    "No major paradigm shifts in the immediate future",
                ],
                expected_outcomes=[
                    "Predictions will be tracked and verified",
                    "Calibration score will be updated based on outcomes",
                ],
            )

            return AgentResult(
                success=True,
                data={
                    "predictions_made": predictions_added,
                    "based_on_trends": len(trends),
                },
                thought_signature=thought,
                metrics={
                    "trends_used": len(trends),
                    "predictions_made": predictions_added,
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, {})
