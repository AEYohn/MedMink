"""Gemini API client with rate limiting, retry logic, and cost tracking."""

import asyncio
import json
import time
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Any, TypeVar

import structlog
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from src.config import settings
from src.gemini.rate_limiter import RateLimiter
from src.gemini.schemas import (
    PaperAnalysisSchema,
    ClaimExtractionSchema,
    ContradictionAnalysisSchema,
    TrendAnalysisSchema,
    PredictionSchema,
    SynthesisSchema,
    SelfCorrectionSchema,
)
from src.cache import get_analysis_cache

logger = structlog.get_logger()

T = TypeVar("T")


# Pricing per 1M tokens (approximate for Gemini 2.0)
GEMINI_PRICING = {
    "input": 0.075,  # $0.075 per 1M input tokens
    "output": 0.30,  # $0.30 per 1M output tokens
    "thinking": 3.50,  # Thinking tokens if enabled
}


class GeminiError(Exception):
    """Base exception for Gemini client errors."""

    pass


class GeminiRateLimitError(GeminiError):
    """Rate limit exceeded."""

    pass


class GeminiAPIError(GeminiError):
    """API error from Gemini."""

    pass


class CostTracker:
    """Tracks API costs over time."""

    def __init__(self, daily_budget: float, monthly_budget: float):
        self.daily_budget = daily_budget
        self.monthly_budget = monthly_budget
        self.usage: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def record_usage(
        self,
        input_tokens: int,
        output_tokens: int,
        thinking_tokens: int = 0,
        operation: str = "unknown",
    ) -> dict[str, Any]:
        """Record API usage and calculate cost."""
        cost = (
            (input_tokens / 1_000_000) * GEMINI_PRICING["input"]
            + (output_tokens / 1_000_000) * GEMINI_PRICING["output"]
            + (thinking_tokens / 1_000_000) * GEMINI_PRICING["thinking"]
        )

        async with self._lock:
            usage_record = {
                "timestamp": datetime.utcnow(),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "thinking_tokens": thinking_tokens,
                "cost_usd": cost,
                "operation": operation,
            }
            self.usage.append(usage_record)

            # Cleanup old entries (keep last 30 days)
            cutoff = datetime.utcnow() - timedelta(days=30)
            self.usage = [u for u in self.usage if u["timestamp"] > cutoff]

            return usage_record

    def _get_daily_cost(self) -> float:
        """Get total cost for today."""
        today = datetime.utcnow().date()
        return sum(
            u["cost_usd"]
            for u in self.usage
            if u["timestamp"].date() == today
        )

    def _get_monthly_cost(self) -> float:
        """Get total cost for this month."""
        this_month = datetime.utcnow().replace(day=1).date()
        return sum(
            u["cost_usd"]
            for u in self.usage
            if u["timestamp"].date() >= this_month
        )

    def check_budget(self) -> tuple[bool, str | None]:
        """Check if we're within budget."""
        daily = self._get_daily_cost()
        monthly = self._get_monthly_cost()

        if daily >= self.daily_budget:
            return False, f"Daily budget exceeded: ${daily:.2f} / ${self.daily_budget:.2f}"
        if monthly >= self.monthly_budget:
            return False, f"Monthly budget exceeded: ${monthly:.2f} / ${self.monthly_budget:.2f}"
        return True, None

    def get_stats(self) -> dict[str, Any]:
        """Get usage statistics."""
        return {
            "daily_cost": self._get_daily_cost(),
            "daily_budget": self.daily_budget,
            "monthly_cost": self._get_monthly_cost(),
            "monthly_budget": self.monthly_budget,
            "total_requests": len(self.usage),
            "daily_requests": sum(
                1
                for u in self.usage
                if u["timestamp"].date() == datetime.utcnow().date()
            ),
        }


class GeminiClient:
    """Client for Gemini API with rate limiting and cost tracking."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        requests_per_minute: int | None = None,
        tokens_per_minute: int | None = None,
        daily_budget: float | None = None,
        monthly_budget: float | None = None,
        use_dspy: bool | None = None,
    ):
        import google.generativeai as genai

        self.api_key = api_key or settings.gemini_api_key
        self.model_name = model or settings.gemini_model

        # Configure the API
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)
        self._genai = genai

        # Rate limiter
        self.rate_limiter = RateLimiter(
            requests_per_minute=requests_per_minute or settings.gemini_requests_per_minute,
            tokens_per_minute=tokens_per_minute or settings.gemini_tokens_per_minute,
        )

        # Cost tracker
        self.cost_tracker = CostTracker(
            daily_budget=daily_budget or settings.daily_budget_usd,
            monthly_budget=monthly_budget or settings.monthly_budget_usd,
        )

        # Analysis cache
        self.cache = get_analysis_cache()

        # Token budget based on analysis mode
        self.analysis_mode = settings.analysis_mode
        self.token_budgets = {
            "quick": settings.quick_analysis_max_tokens,
            "standard": settings.standard_analysis_max_tokens,
            "deep": settings.deep_analysis_max_tokens,
        }

        # DSPy integration for declarative analysis
        self._use_dspy = use_dspy if use_dspy is not None else settings.use_dspy
        self._dspy_client = None

        if self._use_dspy:
            try:
                from src.dspy_analysis import get_dspy_client
                self._dspy_client = get_dspy_client()
                logger.info("DSPy analysis enabled")
            except Exception as e:
                logger.warning("Failed to initialize DSPy client, falling back to manual prompts", error=str(e))
                self._use_dspy = False

        logger.info(
            "Gemini client initialized",
            model=self.model_name,
            requests_per_minute=requests_per_minute or settings.gemini_requests_per_minute,
            analysis_mode=self.analysis_mode,
            use_dspy=self._use_dspy,
        )

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count for text."""
        # Rough estimate: ~4 characters per token
        return len(text) // 4

    @retry(
        retry=retry_if_exception_type((GeminiRateLimitError, GeminiAPIError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
    )
    async def generate(
        self,
        prompt: str,
        schema: dict[str, Any] | None = None,
        thinking_budget: int | None = None,
        temperature: float = 0.7,
        max_output_tokens: int = 8192,
        operation: str = "generate",
    ) -> dict[str, Any]:
        """
        Generate content using Gemini.

        Args:
            prompt: The prompt to send.
            schema: JSON schema for structured output.
            thinking_budget: Token budget for thinking (enables thinking mode).
            temperature: Sampling temperature.
            max_output_tokens: Maximum output tokens.
            operation: Operation name for tracking.

        Returns:
            Dictionary with 'content', 'thinking' (if enabled), and 'usage'.
        """
        # Check budget
        within_budget, error = self.cost_tracker.check_budget()
        if not within_budget:
            raise GeminiError(f"Budget exceeded: {error}")

        # Estimate tokens for rate limiting
        estimated_input = self._estimate_tokens(prompt)
        estimated_output = max_output_tokens // 2  # Assume half of max
        estimated_total = estimated_input + estimated_output

        # Acquire rate limit permission
        await self.rate_limiter.acquire(estimated_total)

        start_time = time.time()

        try:
            # Build generation config
            generation_config = self._genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            )

            # Modify prompt to request JSON if schema provided
            final_prompt = prompt
            if schema:
                final_prompt = f"{prompt}\n\nRespond with valid JSON only. Do not include markdown code blocks or any other text."

            # Build the content
            contents = [{"role": "user", "parts": [{"text": final_prompt}]}]

            # Generate response
            response = await asyncio.to_thread(
                self.model.generate_content,
                contents,
                generation_config=generation_config,
            )

            # Extract usage information
            usage_metadata = getattr(response, "usage_metadata", None)
            input_tokens = getattr(usage_metadata, "prompt_token_count", estimated_input) if usage_metadata else estimated_input
            output_tokens = getattr(usage_metadata, "candidates_token_count", 0) if usage_metadata else 0
            thinking_tokens = 0  # Gemini doesn't expose this separately

            # Update rate limiter with actual tokens
            actual_tokens = input_tokens + output_tokens
            await self.rate_limiter.record_actual_tokens(estimated_total, actual_tokens)

            # Record usage
            usage_record = await self.cost_tracker.record_usage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                thinking_tokens=thinking_tokens,
                operation=operation,
            )

            # Extract content
            content = response.text or ""
            if schema:
                try:
                    # Strip markdown code blocks if present
                    import re
                    content_str = content.strip() if content else ""
                    if content_str.startswith("```"):
                        content_str = re.sub(r'^```(?:json)?\s*\n?', '', content_str)
                        content_str = re.sub(r'\n?```\s*$', '', content_str)
                    if content_str:
                        # Fix unescaped backslashes in LaTeX formulas
                        # First, protect already escaped backslashes
                        content_str = content_str.replace('\\\\', '\x00DOUBLE_BACKSLASH\x00')
                        # Escape remaining backslashes that aren't valid JSON escapes
                        # Valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
                        content_str = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', content_str)
                        # Restore double backslashes
                        content_str = content_str.replace('\x00DOUBLE_BACKSLASH\x00', '\\\\')
                        content = json.loads(content_str)
                    else:
                        content = {}
                except Exception as e:
                    logger.warning("Failed to parse JSON response", content=content[:200] if content else "", error=str(e))
                    # Return empty dict instead of string to prevent .get() errors
                    content = {}
                # Final safety check - ensure we return a dict not a string
                if not isinstance(content, dict):
                    logger.warning("Content is not a dict, converting to empty dict", content_type=type(content).__name__)
                    content = {}

            duration_ms = int((time.time() - start_time) * 1000)

            return {
                "content": content,
                "thinking": None,  # Would contain thinking output if supported
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "thinking_tokens": thinking_tokens,
                    "cost_usd": usage_record["cost_usd"],
                    "duration_ms": duration_ms,
                },
            }

        except Exception as e:
            error_str = str(e).lower()
            if "rate" in error_str or "quota" in error_str or "429" in error_str:
                raise GeminiRateLimitError(f"Rate limit error: {e}") from e
            elif "api" in error_str or "500" in error_str or "503" in error_str:
                raise GeminiAPIError(f"API error: {e}") from e
            else:
                raise GeminiError(f"Gemini error: {e}") from e

    async def analyze_paper(
        self,
        title: str,
        abstract: str,
        full_text: str | None = None,
        mode: str | None = None,
        skip_cache: bool = False,
    ) -> dict[str, Any]:
        """Analyze a paper and extract structured information.

        Args:
            title: Paper title
            abstract: Paper abstract
            full_text: Optional full paper text from PDF extraction
            mode: Analysis mode (quick/standard/deep). Uses config default if None.
            skip_cache: If True, skip cache lookup and force fresh analysis.

        Returns:
            Structured analysis with claims, methods, techniques.
        """
        # Use DSPy if enabled for better extraction quality
        if self._use_dspy and self._dspy_client:
            logger.debug("Using DSPy for paper analysis", title=title[:50])
            try:
                result = await self._dspy_client.analyze_paper(
                    title=title,
                    abstract=abstract,
                    full_text=full_text,
                    mode=mode,
                    skip_cache=skip_cache,
                )
                # Cache the result
                if not skip_cache:
                    await self.cache.set(title, abstract, result)
                return result
            except Exception as e:
                logger.warning("DSPy analysis failed, falling back to manual prompts", error=str(e))

        # Check cache first (research-backed: trajectory recycling)
        # Only use cache for abstract-only analysis to ensure full-text gives fresh results
        if not skip_cache and not full_text:
            cached = await self.cache.get(title, abstract)
            if cached:
                logger.info("Using cached analysis", title=title[:50])
                return cached

            # Check for similar paper analysis
            similar, score = await self.cache.get_similar(title, abstract)
            if similar:
                logger.info(
                    "Using similar paper analysis",
                    title=title[:50],
                    similarity=f"{score:.1%}",
                )
                return similar

        # Determine token budget based on mode and whether we have full text
        analysis_mode = mode or self.analysis_mode
        base_tokens = self.token_budgets.get(analysis_mode, 8192)

        # Increase token budget when we have full text to allow richer extraction
        if full_text:
            max_tokens = min(base_tokens * 2, 32000)
            logger.info("Using expanded token budget for full-text analysis", max_tokens=max_tokens)
        else:
            max_tokens = base_tokens

        # Build the prompt based on whether we have full text
        if full_text:
            # Full paper text available - use enhanced extraction prompt
            prompt = f"""Analyze this research paper IN DEPTH and extract key information as JSON.

TITLE: {title}

ABSTRACT: {abstract}

FULL PAPER CONTENT (key sections):
{full_text[:25000]}

You have access to the FULL PAPER TEXT. This is critical - you MUST:
1. Find and extract VERBATIM mathematical formulas from the Methods/Algorithm sections
2. Convert any algorithm descriptions into structured pseudocode
3. Extract specific hyperparameters and implementation details
4. Note any training tricks, optimization techniques, or practical guidance

Return a JSON object with exactly these lowercase keys:

{{
  "summary": "2-3 sentence summary of the main contribution",
  "claims": [
    {{
      "statement": "A complete sentence stating the claim (e.g., 'The proposed method achieves 95% accuracy on ImageNet')",
      "category": "performance|methodology|theoretical|empirical|limitation",
      "confidence": 0.8,
      "evidence": "Supporting evidence from the paper"
    }}
  ],
  "methods": [
    {{
      "name": "Method name",
      "description": "Brief description",
      "is_novel": false
    }}
  ],
  "techniques": [
    {{
      "name": "Technique name (e.g., 'Multi-Head Attention', 'AdamW')",
      "type": "algorithm|architecture|loss_function|optimization|regularization|math_formula|training_technique|inference_technique|data_augmentation|other",
      "description": "How it's used in this paper",
      "formula": "The EXACT mathematical formula in LaTeX notation - COPY FROM THE PAPER",
      "pseudocode": "Step-by-step algorithm pseudocode - EXTRACT FROM THE PAPER",
      "implementation_notes": "Practical tips from the paper (hyperparameters, common pitfalls, library functions)",
      "is_novel": false,
      "improves_upon": "What it improves, if any"
    }}
  ],
  "keywords": ["keyword1", "keyword2"],
  "confidence_overall": 0.85
}}

CRITICAL INSTRUCTIONS FOR FULL-TEXT ANALYSIS:

1. FORMULA EXTRACTION - Look in the paper for equations and COPY THEM EXACTLY in LaTeX:
   - Search for equation environments, inline math ($...$), display math
   - Common formulas: loss functions, attention mechanisms, update rules, normalization
   - Format: "\\\\text{{Name}}(x) = ..." with proper escaping for JSON

2. PSEUDOCODE EXTRACTION - Convert any algorithms to structured format:
   ```
   Algorithm: [Name]
   Input: [parameters with types]
   Output: [what it returns]
   1. [Step 1]
   2. [Step 2]
      a. [Sub-step if nested]
   3. return [result]
   ```

3. IMPLEMENTATION NOTES - Extract from paper:
   - Exact hyperparameters used (learning rate, batch size, etc.)
   - Framework/library recommendations
   - Training tricks mentioned
   - Common failure modes and how to avoid them
   - Hardware requirements if mentioned

4. QUANTITATIVE CLAIMS - Extract with specific numbers:
   - "Achieves 94.2% accuracy on ImageNet" not "achieves good accuracy"
   - Include dataset names, metrics, and comparison baselines

EXAMPLE of properly extracted technique:
{{
  "name": "Scaled Dot-Product Attention",
  "type": "architecture",
  "description": "Core attention mechanism that computes weighted sum of values based on query-key similarity",
  "formula": "\\\\text{{Attention}}(Q,K,V) = \\\\text{{softmax}}\\\\left(\\\\frac{{QK^T}}{{\\\\sqrt{{d_k}}}}\\\\right)V",
  "pseudocode": "Algorithm: Scaled Dot-Product Attention\\nInput: Q (queries), K (keys), V (values), d_k (key dimension)\\n1. Compute scores = Q @ K.transpose(-2, -1)\\n2. Scale: scores = scores / sqrt(d_k)\\n3. Apply softmax: weights = softmax(scores, dim=-1)\\n4. Apply dropout if training\\n5. return weights @ V",
  "implementation_notes": "Use torch.nn.functional.scaled_dot_product_attention for FlashAttention optimization. d_k typically 64 (512/8 heads). Apply dropout=0.1 during training. Mask padding tokens with -inf before softmax.",
  "is_novel": true,
  "improves_upon": "Additive attention (Bahdanau)"
}}

Extract 5-8 claims and ALL techniques/algorithms from the paper."""
        else:
            # Abstract-only analysis - original prompt
            prompt = f"""Analyze this research paper and extract key information as JSON.

Title: {title}

Abstract: {abstract}

Return a JSON object with exactly these lowercase keys:

{{
  "summary": "2-3 sentence summary of the main contribution",
  "claims": [
    {{
      "statement": "A complete sentence stating the claim (e.g., 'The proposed method achieves 95% accuracy on ImageNet')",
      "category": "performance|methodology|theoretical|empirical|limitation",
      "confidence": 0.8,
      "evidence": "Supporting evidence from the paper"
    }}
  ],
  "methods": [
    {{
      "name": "Method name",
      "description": "Brief description",
      "is_novel": false
    }}
  ],
  "techniques": [
    {{
      "name": "Technique name (e.g., 'Multi-Head Attention', 'AdamW')",
      "type": "algorithm|architecture|loss_function|optimization|regularization|math_formula|training_technique|inference_technique|data_augmentation|other",
      "description": "How it's used in this paper",
      "formula": "The mathematical formula in LaTeX notation if known",
      "pseudocode": "Step-by-step algorithm pseudocode if applicable",
      "implementation_notes": "Practical tips for implementing this technique",
      "is_novel": false,
      "improves_upon": "What it improves, if any"
    }}
  ],
  "keywords": ["keyword1", "keyword2"],
  "confidence_overall": 0.85
}}

IMPORTANT - FORMULA EXTRACTION:
For each technique, include the mathematical formula if one exists. Examples of proper LaTeX formulas:
- Attention: "\\\\text{{Attention}}(Q,K,V) = \\\\text{{softmax}}\\\\left(\\\\frac{{QK^T}}{{\\\\sqrt{{d_k}}}}\\\\right)V"
- Cross-Entropy: "\\\\mathcal{{L}} = -\\\\sum_{{i}} y_i \\\\log(\\\\hat{{y}}_i)"

REQUIREMENTS:
- Extract 3-5 claims with COMPLETE sentences (not fragments)
- Extract notable techniques, algorithms, loss functions mentioned
- Include formulas and pseudocode where possible based on the abstract
- Use lowercase keys exactly as shown
- Each claim statement must be specific and informative"""

        result = await self.generate(
            prompt=prompt,
            schema=PaperAnalysisSchema,
            operation="analyze_paper",
            max_output_tokens=max_tokens,
        )
        content = result["content"]
        # Normalize keys to lowercase in case Gemini returns uppercase
        if isinstance(content, dict):
            content = {k.lower(): v for k, v in content.items()}

        # Cache the result
        await self.cache.set(title, abstract, content)

        return content

    async def analyze_papers_batch(
        self,
        papers: list[dict[str, str]],
        mode: str | None = None,
    ) -> list[dict[str, Any]]:
        """Analyze multiple papers in a single API call.

        Research-backed optimization from "Agent Workflow Optimization":
        "Meta-tools bypass unnecessary intermediate LLM reasoning steps and reduce operational cost"

        Args:
            papers: List of dicts with 'title' and 'abstract' keys
            mode: Analysis mode (quick/standard/deep)

        Returns:
            List of analysis results in same order as input papers
        """
        if not papers:
            return []

        # Use DSPy if enabled
        if self._use_dspy and self._dspy_client:
            logger.debug("Using DSPy for batch analysis", count=len(papers))
            try:
                results = await self._dspy_client.analyze_papers_batch(papers, mode=mode)
                # Cache individual results
                for paper, result in zip(papers, results):
                    if result.get("summary"):  # Only cache successful analyses
                        await self.cache.set(paper["title"], paper["abstract"], result)
                return results
            except Exception as e:
                logger.warning("DSPy batch analysis failed, falling back", error=str(e))

        # Check cache for all papers first
        results = []
        uncached_papers = []
        uncached_indices = []

        for i, paper in enumerate(papers):
            cached = await self.cache.get(paper["title"], paper["abstract"])
            if cached:
                results.append((i, cached))
                logger.debug("Batch: cache hit", title=paper["title"][:30])
            else:
                uncached_papers.append(paper)
                uncached_indices.append(i)
                results.append((i, None))

        if not uncached_papers:
            # All papers were cached
            logger.info("Batch analysis: all papers cached", count=len(papers))
            return [r[1] for r in sorted(results, key=lambda x: x[0])]

        # Build batch prompt for uncached papers
        analysis_mode = mode or self.analysis_mode
        max_tokens = min(
            settings.max_batch_tokens,
            self.token_budgets.get(analysis_mode, 8192) * len(uncached_papers),
        )

        papers_text = ""
        for idx, paper in enumerate(uncached_papers):
            papers_text += f"""
---
PAPER {idx + 1}:
Title: {paper["title"]}
Abstract: {paper["abstract"][:1500]}
---
"""

        prompt = f"""Analyze these {len(uncached_papers)} research papers and extract key information.

{papers_text}

Return a JSON object with a "papers" array containing one analysis object per paper IN ORDER.
Each analysis object should have:

{{
  "papers": [
    {{
      "paper_index": 1,
      "summary": "2-3 sentence summary",
      "claims": [
        {{
          "statement": "Complete claim sentence",
          "category": "performance|methodology|theoretical|empirical|limitation",
          "confidence": 0.8,
          "evidence": "Supporting evidence"
        }}
      ],
      "methods": [
        {{
          "name": "Method name",
          "description": "Brief description",
          "is_novel": false
        }}
      ],
      "techniques": [
        {{
          "name": "Technique name",
          "type": "algorithm|architecture|loss_function|optimization|other",
          "description": "Description",
          "formula": "LaTeX formula if applicable",
          "pseudocode": "Algorithm steps if applicable",
          "implementation_notes": "Practical guidance",
          "is_novel": false
        }}
      ],
      "keywords": ["keyword1", "keyword2"]
    }}
  ]
}}

Extract 2-4 claims and techniques per paper. Focus on ACTIONABLE content with formulas and pseudocode."""

        result = await self.generate(
            prompt=prompt,
            schema={"type": "object", "properties": {"papers": {"type": "array"}}},
            operation="analyze_papers_batch",
            max_output_tokens=max_tokens,
        )

        content = result["content"]
        batch_results = content.get("papers", []) if isinstance(content, dict) else []

        # Map batch results back to original indices and cache them
        for batch_idx, paper_analysis in enumerate(batch_results):
            if batch_idx < len(uncached_papers):
                original_idx = uncached_indices[batch_idx]
                paper = uncached_papers[batch_idx]

                # Normalize keys
                if isinstance(paper_analysis, dict):
                    paper_analysis = {k.lower(): v for k, v in paper_analysis.items()}
                    # Remove paper_index from result
                    paper_analysis.pop("paper_index", None)

                # Update results
                results[original_idx] = (original_idx, paper_analysis)

                # Cache the individual result
                await self.cache.set(paper["title"], paper["abstract"], paper_analysis)

        logger.info(
            "Batch analysis complete",
            total=len(papers),
            cached=len(papers) - len(uncached_papers),
            analyzed=len(uncached_papers),
        )

        return [r[1] for r in sorted(results, key=lambda x: x[0])]

    async def extract_claims(
        self,
        title: str,
        abstract: str,
        context: str | None = None,
    ) -> dict[str, Any]:
        """Extract claims from a paper."""
        prompt = f"""Extract all significant claims from this research paper.

Title: {title}

Abstract: {abstract}

{f"Additional Context: {context}" if context else ""}

For each claim:
- State it precisely and completely
- Categorize it (performance, methodology, theoretical, empirical, limitation, comparison)
- Assess confidence (0-1) based on evidence strength
- Note if it's quantitative and include any metrics

Focus on claims that are novel, important, or could potentially contradict other research."""

        result = await self.generate(
            prompt=prompt,
            schema=ClaimExtractionSchema,
            operation="extract_claims",
        )
        return result["content"]

    async def detect_contradictions(
        self,
        claims: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Detect contradictions between claims."""
        # Use DSPy if enabled
        if self._use_dspy and self._dspy_client:
            logger.debug("Using DSPy for contradiction detection", claim_count=len(claims))
            try:
                return await self._dspy_client.detect_contradictions(claims)
            except Exception as e:
                logger.warning("DSPy contradiction detection failed, falling back", error=str(e))

        claims_text = "\n".join(
            f"{i}. [{c.get('category', 'unknown')}] {c['statement']}"
            for i, c in enumerate(claims)
        )

        prompt = f"""Analyze these research claims for contradictions.

Claims:
{claims_text}

Identify any pairs of claims that:
1. Directly contradict each other
2. Use incompatible methodologies to reach different conclusions
3. Present conflicting empirical findings
4. Offer mutually exclusive interpretations

For each contradiction:
- Reference claim indices
- Classify the type of contradiction
- Rate the strength (0-1)
- Explain the nature of the conflict
- Suggest if reconciliation is possible

Be precise - only flag genuine contradictions, not mere differences in scope or focus."""

        result = await self.generate(
            prompt=prompt,
            schema=ContradictionAnalysisSchema,
            operation="detect_contradictions",
        )
        return result["content"]

    async def identify_trends(
        self,
        papers_summary: str,
        historical_trends: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Identify research trends from papers."""
        historical_context = ""
        if historical_trends:
            historical_context = "\n\nPreviously identified trends:\n" + "\n".join(
                f"- {t['name']}: {t['direction']} (velocity: {t['velocity']})"
                for t in historical_trends
            )

        prompt = f"""Analyze these recent papers to identify research trends.

Papers Summary:
{papers_summary}
{historical_context}

Identify:
1. Emerging trends (new topics gaining traction)
2. Accelerating trends (established topics growing faster)
3. Declining trends (topics losing momentum)

For each trend:
- Name it clearly
- Describe what it encompasses
- Assess direction and velocity (0-10 scale)
- Cite evidence from the papers
- Note related methods or techniques

Also provide meta-observations about the overall research landscape."""

        result = await self.generate(
            prompt=prompt,
            schema=TrendAnalysisSchema,
            operation="identify_trends",
        )
        return result["content"]

    async def generate_predictions(
        self,
        trends: list[dict[str, Any]],
        recent_developments: str,
    ) -> dict[str, Any]:
        """Generate predictions based on trends and developments."""
        trends_text = "\n".join(
            f"- {t['name']}: {t.get('direction', 'unknown')} (velocity: {t.get('velocity', 'unknown')})"
            for t in trends
        )

        prompt = f"""Based on current research trends and developments, generate specific, falsifiable predictions.

Current Trends:
{trends_text}

Recent Developments:
{recent_developments}

Generate predictions that are:
1. Specific and measurable
2. Time-bound (1 month, 3 months, 6 months, or 1 year)
3. Falsifiable (we can verify if they came true)
4. Based on evidence from the trends

For each prediction:
- State it precisely
- Assign a confidence level (be calibrated - don't be overconfident)
- Explain your reasoning
- Define how we'll verify it

Focus on predictions about method adoption, performance improvements, new capabilities, and paradigm shifts."""

        result = await self.generate(
            prompt=prompt,
            schema=PredictionSchema,
            operation="generate_predictions",
        )
        return result["content"]

    async def synthesize_weekly(
        self,
        papers: list[dict[str, Any]],
        claims: list[dict[str, Any]],
        trends: list[dict[str, Any]],
        contradictions: list[dict[str, Any]],
        predictions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Generate weekly synthesis report."""
        prompt = f"""Generate a comprehensive weekly research synthesis report.

PAPERS ANALYZED ({len(papers)} total):
{json.dumps(papers[:20], indent=2, default=str)}

KEY CLAIMS ({len(claims)} total):
{json.dumps(claims[:30], indent=2, default=str)}

IDENTIFIED TRENDS ({len(trends)} total):
{json.dumps(trends, indent=2, default=str)}

CONTRADICTIONS FOUND ({len(contradictions)} total):
{json.dumps(contradictions, indent=2, default=str)}

PREDICTIONS MADE ({len(predictions)} total):
{json.dumps(predictions, indent=2, default=str)}

Write a synthesis report that:
1. Opens with an executive summary (2-3 paragraphs) for a technical audience
2. Highlights the most significant developments
3. Identifies emerging themes and patterns
4. Discusses notable contradictions and what they mean
5. Closes with an outlook for the coming weeks

Be insightful and analytical, not just descriptive."""

        result = await self.generate(
            prompt=prompt,
            schema=SynthesisSchema,
            operation="synthesize_weekly",
            max_output_tokens=16384,
        )
        return result["content"]

    async def analyze_error(
        self,
        error: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Analyze an error and suggest corrections."""
        prompt = f"""Analyze this error that occurred during research synthesis.

Error: {error}

Context:
{json.dumps(context, indent=2, default=str)}

Provide:
1. Analysis of the error type and root cause
2. Severity assessment
3. Recommended correction strategy
4. Steps to prevent similar errors

Be specific about what action to take (retry, skip, modify input, escalate, or abort)."""

        result = await self.generate(
            prompt=prompt,
            schema=SelfCorrectionSchema,
            operation="analyze_error",
        )
        return result["content"]

    def get_stats(self) -> dict[str, Any]:
        """Get client statistics."""
        return {
            "rate_limiter": self.rate_limiter.get_stats(),
            "cost_tracker": self.cost_tracker.get_stats(),
            "model": self.model_name,
        }


# Singleton instance
_client: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    """Get or create Gemini client singleton."""
    global _client
    if _client is None:
        _client = GeminiClient()
    return _client
