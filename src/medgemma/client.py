"""MedGemma client for Google's Health AI Developer Foundations (HAI-DEF).

Uses the official MedGemma models from Hugging Face for medical text/image understanding.
Required for the MedGemma Impact Challenge.

Models:
- google/medgemma-1.5-4b-it (text, latest, recommended)
- google/medgemma-4b-it (text)
- google/medgemma-27b-it (text, larger, requires more VRAM)
- google/paligemma-3b-mix-448 (vision, for medical images)
"""

import asyncio
import base64
import json
from pathlib import Path
from typing import Any

import structlog

from src.config import settings
from src.medgemma.prompts import (
    CLINICAL_REASONING_SYSTEM,
    PICO_EXTRACTION_PROMPT,
    EVIDENCE_GRADING_PROMPT,
    EVIDENCE_SYNTHESIS_PROMPT,
    DRUG_INTERACTION_PROMPT,
)

logger = structlog.get_logger()

# Default models
DEFAULT_MODEL = "google/medgemma-1.5-4b-it"
DEFAULT_VISION_MODEL = "google/paligemma-3b-mix-448"  # Vision-language model

# Medical image analysis prompt
MEDICAL_IMAGE_ANALYSIS_PROMPT = """Analyze this medical image and provide a clinical assessment.

Focus on:
1. Image modality and quality
2. Key anatomical structures visible
3. Any abnormal findings
4. Clinical significance
5. Differential diagnoses if abnormalities present

{context}

Provide your analysis as JSON:
{{
    "modality": "X-ray|CT|MRI|Ultrasound|Other",
    "body_region": "identified region",
    "quality": "adequate|suboptimal|poor",
    "findings": ["finding 1", "finding 2"],
    "abnormalities": ["abnormality 1", "abnormality 2"],
    "impression": "overall clinical impression",
    "differential_diagnoses": ["diagnosis 1", "diagnosis 2"],
    "recommendations": ["recommendation 1"],
    "confidence": 0.0-1.0
}}"""


class MedGemmaClient:
    """Client for MedGemma inference using Hugging Face Transformers.

    Uses Google's official MedGemma models for medical text understanding.
    Supports local inference, Modal remote GPU (27B), and Vertex AI.
    """

    def __init__(
        self,
        model_name: str | None = None,
        device: str = "auto",
        load_in_4bit: bool = True,
        max_memory: dict | None = None,
    ):
        """Initialize MedGemma client.

        Args:
            model_name: HuggingFace model ID (default: google/medgemma-1.5-4b-it)
            device: Device to run on ("auto", "cuda", "mps", "cpu")
            load_in_4bit: Use 4-bit quantization to reduce memory
            max_memory: Max memory per device for model sharding
        """
        self.model_name = model_name or getattr(settings, 'medgemma_model', DEFAULT_MODEL)
        self.device = device
        self.load_in_4bit = load_in_4bit
        self.max_memory = max_memory

        self._model = None
        self._tokenizer = None
        self._initialized = False

        # Modal remote inference (MedGemma 27B on GPU)
        self._modal_url = getattr(settings, 'medgemma_modal_url', '') or ''
        self._modal_model = getattr(settings, 'medgemma_modal_model', 'google/medgemma-27b-it')

        if self._modal_url:
            logger.info(
                "MedGemma client configured (Modal 27B remote)",
                modal_url=self._modal_url,
                modal_model=self._modal_model,
            )
        else:
            logger.info(
                "MedGemma client configured (local)",
                model=self.model_name,
                device=self.device,
                quantized=self.load_in_4bit,
            )

    def _ensure_initialized(self):
        """Lazily initialize the model."""
        if self._initialized:
            return

        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

            logger.info("Loading MedGemma model...", model=self.model_name)

            # Set up quantization config for 4-bit inference
            quantization_config = None
            if self.load_in_4bit:
                quantization_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.bfloat16,
                    bnb_4bit_use_double_quant=True,
                    bnb_4bit_quant_type="nf4",
                )

            # Determine device
            if self.device == "auto":
                if torch.cuda.is_available():
                    device_map = "auto"
                elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    device_map = "mps"
                    quantization_config = None  # MPS doesn't support bitsandbytes
                else:
                    device_map = "cpu"
                    quantization_config = None  # CPU doesn't support bitsandbytes
            else:
                device_map = self.device

            # Load tokenizer
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                trust_remote_code=True,
            )

            # Load model
            # Note: MPS (Apple Silicon) requires float32 for Gemma3 architecture
            # bfloat16 causes pad token generation issues on MPS
            if device_map == "mps":
                dtype = torch.float32
            elif device_map == "cpu":
                dtype = torch.float32
            else:
                dtype = torch.bfloat16

            model_kwargs = {
                "trust_remote_code": True,
                "device_map": device_map,
                "torch_dtype": dtype,
                "low_cpu_mem_usage": True,
            }

            if quantization_config:
                model_kwargs["quantization_config"] = quantization_config

            if self.max_memory:
                model_kwargs["max_memory"] = self.max_memory

            self._model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                **model_kwargs,
            )

            logger.info(
                "MedGemma model loaded successfully",
                model=self.model_name,
                device=device_map,
            )
            self._initialized = True

        except ImportError as e:
            logger.error(
                "Missing dependencies for MedGemma",
                error=str(e),
                hint="Install with: pip install transformers torch accelerate bitsandbytes",
            )
            self._initialized = True
        except Exception as e:
            logger.error("Failed to load MedGemma model", error=str(e))
            self._initialized = True

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
        stop: list[str] | None = None,
    ) -> str:
        """Generate text using MedGemma.

        Routes to Modal 27B if configured, otherwise uses local 4B inference.

        Args:
            prompt: User prompt
            system_prompt: System prompt (defaults to clinical reasoning)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            stop: Stop sequences

        Returns:
            Generated text
        """
        sys = system_prompt or CLINICAL_REASONING_SYSTEM

        if self._modal_url:
            return await self._generate_modal(prompt, sys, max_tokens, temperature)

        result = await asyncio.to_thread(
            self._generate_sync,
            prompt=prompt,
            system_prompt=sys,
            max_tokens=max_tokens,
            temperature=temperature,
            stop=stop,
        )
        return result

    async def _generate_modal(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Generate via Modal-hosted MedGemma 27B (OpenAI-compatible vLLM endpoint)."""
        import aiohttp

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]
        payload = {
            "model": self._modal_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }

        try:
            timeout = aiohttp.ClientTimeout(total=600)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/v1/chat/completions",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error(
                            "Modal 27B request failed",
                            status=resp.status,
                            body=body[:500],
                        )
                        # Fall back to local inference
                        return await asyncio.to_thread(
                            self._generate_sync,
                            prompt=prompt,
                            system_prompt=system_prompt,
                            max_tokens=max_tokens,
                            temperature=temperature,
                            stop=None,
                        )

                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]

                    logger.info(
                        "Modal 27B response",
                        tokens=data.get("usage", {}),
                        length=len(content),
                    )

                    # Clean response (27B is cleaner but may still have artifacts)
                    return self._clean_response(content)

        except Exception as e:
            logger.error("Modal 27B call failed, falling back to local", error=str(e))
            return await asyncio.to_thread(
                self._generate_sync,
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=None,
            )

    def _generate_sync(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int,
        temperature: float,
        stop: list[str] | None,
    ) -> str:
        """Synchronous generation (runs in thread pool)."""
        self._ensure_initialized()

        if self._model is None or self._tokenizer is None:
            logger.warning("MedGemma model not available, using fallback")
            return self._fallback_response(prompt)

        try:
            # Format as chat messages for instruction-tuned model
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ]

            # Apply chat template
            input_text = self._tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )

            # Tokenize
            inputs = self._tokenizer(input_text, return_tensors="pt")
            inputs = {k: v.to(self._model.device) for k, v in inputs.items()}

            # Generate
            import torch
            with torch.no_grad():
                outputs = self._model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature if temperature > 0 else None,
                    do_sample=temperature > 0,
                    pad_token_id=self._tokenizer.eos_token_id,
                )

            # Decode response (skip input tokens)
            response = self._tokenizer.decode(
                outputs[0][inputs["input_ids"].shape[1]:],
                skip_special_tokens=True,
            )

            # Clean up chain-of-thought tokens from MedGemma output
            response = self._clean_response(response)
            return response.strip()

        except Exception as e:
            logger.error("MedGemma generation failed", error=str(e))
            return self._fallback_response(prompt)

    def _clean_response(self, response: str) -> str:
        """Clean up MedGemma chain-of-thought tokens from response.

        MedGemma sometimes outputs thinking tokens like <unused94>thought
        followed by reasoning, then the actual answer. This extracts just
        the answer portion.
        """
        import re

        # PRIORITY: If response contains a JSON code block, extract it directly
        # regardless of thinking tokens. This is the most reliable approach.
        json_block_match = re.search(r'```json\s*([\{\[].*)', response, re.DOTALL)
        if json_block_match:
            json_content = json_block_match.group(1)
            # Find the closing ``` if present
            closing = json_content.find('```')
            if closing > 0:
                json_content = json_content[:closing]
            response = json_content.strip()
            # Clean any remaining special tokens inside JSON
            response = re.sub(r"<unused\d+>", "", response)
            return response.strip()

        # If no code block but response has JSON array, try to extract it
        if "<unused" in response and "[" in response:
            arr_match = re.search(r'\[.*\]', response, re.DOTALL)
            if arr_match:
                candidate = arr_match.group()
                # Only use if it looks like a real JSON array (has quotes)
                if '"' in candidate and len(candidate) > 10:
                    response = re.sub(r"<unused\d+>", "", candidate)
                    return response.strip()

        # If no code block but response has JSON object, try to extract it
        # Look for the LAST { ... } block which is more likely the answer
        if "<unused" in response and "{" in response:
            # Find the last JSON-like block in the response
            last_brace = response.rfind('{')
            if last_brace > 0:
                # Check if there's a substantial JSON block (not just a small nested obj)
                candidate = response[last_brace:]
                if len(candidate) > 100 and '"options"' in candidate or '"verdict"' in candidate:
                    response = candidate
                    response = re.sub(r"<unused\d+>", "", response)
                    return response.strip()

        # Remove thinking tokens and content
        if "<unused" in response and "thought" in response.lower():
            # Find where the actual response starts (after thinking)
            patterns = [
                r"<unused\d+>thought.*?(?=\n\n```)",     # Code block after thinking
                r"<unused\d+>thought.*?(?=\n\n\{)",      # JSON object after thinking
                r"<unused\d+>thought.*?(?=\n\n\[)",      # JSON array after thinking
                r"<unused\d+>thought.*?(?=\n\n[A-Z])",   # Double newline + capital
                r"<unused\d+>thought.*?(?=\*\*[A-Z])",   # Markdown bold
                r"<unused\d+>.*?(?=\n[A-Z][a-z]+\s+is\s)",  # "X is" pattern
            ]

            for pattern in patterns:
                match = re.search(pattern, response, re.DOTALL | re.IGNORECASE)
                if match:
                    response = response[match.end():]
                    break
            else:
                # Fallback: just remove the thinking tag
                response = re.sub(r"<unused\d+>thought\s*", "", response)

        # Clean up any remaining special tokens
        response = re.sub(r"<unused\d+>", "", response)

        return response.strip()

    def _fallback_response(self, prompt: str) -> str:
        """Fallback response when model is unavailable."""
        return json.dumps({
            "error": "MedGemma model not available",
            "message": "Please ensure MedGemma is downloaded. Run: huggingface-cli download google/medgemma-1.5-4b-it",
            "fallback": True,
        })

    async def extract_pico(self, question: str) -> dict[str, Any]:
        """Extract PICO elements from a clinical question.

        Args:
            question: Clinical question in natural language

        Returns:
            PICO elements dictionary
        """
        prompt = PICO_EXTRACTION_PROMPT.format(question=question)

        response = await self.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=1024,
        )

        try:
            return self._parse_json_response(response)
        except Exception as e:
            logger.error("PICO extraction failed", error=str(e))
            return {
                "population": "",
                "intervention": "",
                "comparison": "standard of care",
                "outcome": "",
                "question_type": "therapy",
                "mesh_terms": [],
            }

    async def grade_evidence(self, papers: list[dict]) -> dict[str, Any]:
        """Grade evidence quality using GRADE methodology.

        Args:
            papers: List of paper dictionaries with abstracts

        Returns:
            GRADE assessment dictionary
        """
        papers_text = self._format_papers_for_prompt(papers)
        prompt = EVIDENCE_GRADING_PROMPT.format(papers=papers_text)

        response = await self.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=2048,
        )

        try:
            return self._parse_json_response(response)
        except Exception as e:
            logger.error("Evidence grading failed", error=str(e))
            return {
                "paper_grades": [],
                "overall_grade": "very_low",
                "grade_rationale": "Unable to assess evidence quality",
                "key_limitations": ["Automated grading failed"],
            }

    async def synthesize_evidence(
        self,
        question: str,
        papers: list[dict],
    ) -> dict[str, Any]:
        """Synthesize evidence from multiple papers.

        Args:
            question: Clinical question
            papers: List of paper dictionaries

        Returns:
            Evidence synthesis dictionary
        """
        papers_text = self._format_papers_for_prompt(papers)
        prompt = EVIDENCE_SYNTHESIS_PROMPT.format(
            question=question,
            papers=papers_text,
        )

        response = await self.generate(
            prompt=prompt,
            temperature=0.3,
            max_tokens=3000,
        )

        try:
            return self._parse_json_response(response)
        except Exception as e:
            logger.error("Evidence synthesis failed", error=str(e))
            return {
                "summary": "Unable to synthesize evidence",
                "key_findings": [],
                "effect_sizes": [],
                "contradictions": [],
                "limitations": ["Automated synthesis failed"],
                "recommendation": "Consult primary literature",
                "recommendation_strength": "none",
                "evidence_grade": "very_low",
            }

    async def check_drug_interactions(
        self,
        drugs: list[str],
        papers: list[dict],
    ) -> dict[str, Any]:
        """Check for drug interactions based on literature.

        Args:
            drugs: List of drug names
            papers: List of paper dictionaries with interaction data

        Returns:
            Drug interaction assessment
        """
        papers_text = self._format_papers_for_prompt(papers)
        prompt = DRUG_INTERACTION_PROMPT.format(
            drugs=", ".join(drugs),
            papers=papers_text,
        )

        response = await self.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=2048,
        )

        try:
            return self._parse_json_response(response)
        except Exception as e:
            logger.error("Drug interaction check failed", error=str(e))
            return {
                "interactions": [],
                "no_interaction_found": [],
                "insufficient_evidence": drugs,
            }

    def _format_papers_for_prompt(self, papers: list[dict]) -> str:
        """Format papers for inclusion in prompts."""
        formatted = []
        for i, paper in enumerate(papers, 1):
            pmid = paper.get("pmid", paper.get("doi", f"paper_{i}"))
            title = paper.get("title", "Unknown")
            abstract = paper.get("abstract", "")
            year = paper.get("year", "")

            formatted.append(
                f"[{pmid}] {title} ({year})\n"
                f"Abstract: {abstract[:1500]}..."
                if len(abstract) > 1500 else
                f"[{pmid}] {title} ({year})\n"
                f"Abstract: {abstract}"
            )

        return "\n\n".join(formatted)

    def _parse_json_response(self, response: str) -> dict[str, Any]:
        """Parse JSON from model response with robust error handling."""
        import re

        response = response.strip()

        # Handle markdown code blocks
        if "```json" in response:
            try:
                start = response.index("```json") + 7
                try:
                    end = response.index("```", start)
                    response = response[start:end].strip()
                except ValueError:
                    # No closing ```, use everything after ```json (truncated response)
                    response = response[start:].strip()
            except ValueError:
                pass
        elif "```" in response:
            try:
                start = response.index("```") + 3
                try:
                    end = response.index("```", start)
                    response = response[start:end].strip()
                except ValueError:
                    # No closing ```, use everything after ```
                    response = response[start:].strip()
            except ValueError:
                pass

        # Find JSON object boundaries
        if "{" in response:
            start = response.index("{")
            depth = 0
            end = start
            in_string = False
            escape = False
            for i, c in enumerate(response[start:], start):
                if escape:
                    escape = False
                    continue
                if c == "\\":
                    escape = True
                    continue
                if c == '"' and not escape:
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            if end > start:
                response = response[start:end]
            else:
                # Truncated JSON — use everything from the first { to end of string
                response = response[start:]

        # Fix common JSON issues
        # Remove trailing commas before } or ]
        response = re.sub(r',\s*}', '}', response)
        response = re.sub(r',\s*]', ']', response)

        # Fix unescaped newlines in strings (replace with \n)
        # This is a best-effort fix
        response = re.sub(r'(?<!\\)\n(?=[^"]*"[^"]*(?:"[^"]*"[^"]*)*$)', '\\n', response)

        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            logger.warning("JSON parse failed, attempting repair", error=str(e), response_len=len(response))

            # Try to repair truncated JSON by closing open brackets/braces
            try:
                repaired = response.rstrip()

                # Strategy: Find the last complete JSON value and close from there
                # Walk backward from the end to find a "clean" cut point
                # Clean cut points: after }, after ], after "string", after number, after true/false/null

                # First: if we're in the middle of a string, close it
                # Count unescaped quotes
                in_str = False
                last_clean = 0
                for i, c in enumerate(repaired):
                    if c == '\\' and in_str:
                        continue  # skip next char
                    if c == '"':
                        in_str = not in_str
                    if not in_str and c in ('}', ']'):
                        last_clean = i

                if last_clean > 0:
                    repaired = repaired[:last_clean + 1]
                    repaired = repaired.rstrip().rstrip(',')

                # Recount and close
                open_braces = repaired.count('{') - repaired.count('}')
                open_brackets = repaired.count('[') - repaired.count(']')
                repaired += ']' * max(0, open_brackets)
                repaired += '}' * max(0, open_braces)

                result = json.loads(repaired)
                logger.info("Repaired truncated JSON successfully", keys=list(result.keys()) if isinstance(result, dict) else "array")
                return result
            except (json.JSONDecodeError, Exception) as repair_err:
                logger.warning("JSON repair also failed", error=str(repair_err))

            # Try to extract key-value pairs manually as fallback
            try:
                result = {}
                patterns = {
                    "summary": r'"summary"\s*:\s*"([^"]*)"',
                    "evidence_grade": r'"evidence_grade"\s*:\s*"([^"]*)"',
                    "recommendation": r'"recommendation"\s*:\s*"([^"]*)"',
                    "recommendation_strength": r'"recommendation_strength"\s*:\s*"([^"]*)"',
                }
                for key, pattern in patterns.items():
                    match = re.search(pattern, response)
                    if match:
                        result[key] = match.group(1)

                if result:
                    logger.info("Recovered partial JSON", keys=list(result.keys()))
                    return result
            except Exception:
                pass

            raise

    async def generate_multimodal(
        self,
        image_b64: str,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.2,
    ) -> str:
        """Generate response from image + text using the multimodal Modal endpoint.

        Args:
            image_b64: Base64-encoded image (with or without data URI prefix)
            prompt: Text prompt to accompany the image
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature

        Returns:
            Generated text response
        """
        multimodal_url = getattr(settings, 'medgemma_multimodal_modal_url', '') or ''
        multimodal_model = getattr(settings, 'medgemma_multimodal_modal_model', 'google/medgemma-27b-multimodal')

        # Fall back to text modal if no multimodal URL
        if not multimodal_url:
            multimodal_url = self._modal_url
            multimodal_model = self._modal_model

        if not multimodal_url:
            return json.dumps({"error": "No multimodal endpoint configured"})

        import aiohttp

        # Ensure data URI prefix
        if not image_b64.startswith("data:"):
            image_b64 = f"data:image/png;base64,{image_b64}"

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_b64}},
                    {"type": "text", "text": prompt},
                ],
            },
        ]

        payload = {
            "model": multimodal_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }

        try:
            timeout = aiohttp.ClientTimeout(total=600)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{multimodal_url}/v1/chat/completions",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("Multimodal request failed", status=resp.status, body=body[:500])
                        return json.dumps({"error": f"Multimodal request failed: {resp.status}"})

                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]
                    return self._clean_response(content)

        except Exception as e:
            logger.error("Multimodal call failed", error=str(e))
            return json.dumps({"error": str(e)})

    @property
    def is_available(self) -> bool:
        """Check if local model is available."""
        self._ensure_initialized()
        return self._model is not None

    async def analyze_medical_image(
        self,
        image_path: str,
        clinical_context: str = "",
    ) -> dict[str, Any]:
        """Analyze a medical image using vision-language model.

        Args:
            image_path: Path to the medical image file
            clinical_context: Optional clinical context for the analysis

        Returns:
            Image analysis dictionary with findings, impression, etc.
        """
        result = await asyncio.to_thread(
            self._analyze_image_sync,
            image_path=image_path,
            clinical_context=clinical_context,
        )
        return result

    def _analyze_image_sync(
        self,
        image_path: str,
        clinical_context: str,
    ) -> dict[str, Any]:
        """Synchronous image analysis."""
        self._ensure_initialized()

        try:
            from PIL import Image

            # Load and validate image
            image_file = Path(image_path)
            if not image_file.exists():
                return self._image_analysis_fallback(f"Image not found: {image_path}")

            image = Image.open(image_file)

            # For now, use text model with image description
            # In production, would use PaliGemma or MedGemma vision model
            logger.info("Analyzing medical image", path=image_path, size=image.size)

            # Get basic image info
            width, height = image.size
            mode = image.mode
            format_type = image.format or image_file.suffix.upper().replace(".", "")

            # Determine likely modality from filename or format
            filename_lower = image_file.name.lower()
            if "xray" in filename_lower or "x-ray" in filename_lower or "cxr" in filename_lower:
                likely_modality = "X-ray"
            elif "ct" in filename_lower:
                likely_modality = "CT"
            elif "mri" in filename_lower:
                likely_modality = "MRI"
            elif "ultrasound" in filename_lower or "us_" in filename_lower:
                likely_modality = "Ultrasound"
            else:
                likely_modality = "Unknown"

            # Use text model to generate analysis based on context
            context_prompt = f"""Clinical context: {clinical_context}

Image details:
- Dimensions: {width}x{height} pixels
- Format: {format_type}
- Likely modality: {likely_modality}

Based on the clinical context and image characteristics, provide a preliminary assessment.
Note: This is a text-based analysis. For full image interpretation, ensure the vision model is loaded.

Provide your analysis as JSON:
{{
    "modality": "{likely_modality}",
    "body_region": "inferred from context",
    "quality": "adequate",
    "findings": ["Based on clinical context..."],
    "abnormalities": [],
    "impression": "Preliminary assessment based on clinical context",
    "differential_diagnoses": [],
    "recommendations": ["Correlate with clinical findings", "Review by radiologist recommended"],
    "confidence": 0.5,
    "note": "Vision model analysis pending - using text-based inference"
}}"""

            response = self._generate_sync(
                prompt=context_prompt,
                system_prompt=CLINICAL_REASONING_SYSTEM,
                max_tokens=1500,
                temperature=0.3,
                stop=None,
            )

            try:
                result = self._parse_json_response(response)
                result["image_path"] = str(image_path)
                result["image_size"] = f"{width}x{height}"
                return result
            except Exception:
                return self._image_analysis_fallback("Failed to parse analysis")

        except ImportError:
            logger.warning("PIL not available for image analysis")
            return self._image_analysis_fallback("PIL library not installed")
        except Exception as e:
            logger.error("Image analysis failed", error=str(e))
            return self._image_analysis_fallback(str(e))

    def _image_analysis_fallback(self, error: str) -> dict[str, Any]:
        """Return fallback response for image analysis."""
        return {
            "modality": "Unknown",
            "body_region": "Unknown",
            "quality": "Unable to assess",
            "findings": [],
            "abnormalities": [],
            "impression": f"Image analysis unavailable: {error}",
            "differential_diagnoses": [],
            "recommendations": ["Manual review required"],
            "confidence": 0.0,
            "error": error,
        }


# Singleton instance
_medgemma_client: MedGemmaClient | None = None


def get_medgemma_client() -> MedGemmaClient:
    """Get or create MedGemma client singleton."""
    global _medgemma_client
    if _medgemma_client is None:
        _medgemma_client = MedGemmaClient()
    return _medgemma_client
