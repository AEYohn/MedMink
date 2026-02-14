"""MedGemma Vision - Medical Image Analysis via Modal Multimodal.

Provides medical image understanding using MedGemma's multimodal model
served on Modal GPU infrastructure. Supports:
- Chest X-rays
- CT scans
- MRI images
- Pathology slides
- Dermoscopy images
- Ophthalmology (fundus, OCT)
- Lab report document extraction
"""

import json
from typing import Any

import aiohttp
import structlog

from src.config import settings

logger = structlog.get_logger()


# Modality detection patterns
MODALITY_PATTERNS = {
    "xray": ["xray", "x-ray", "cxr", "chest", "radiograph"],
    "ct": ["ct", "computed", "tomography", "hounsfield"],
    "mri": ["mri", "magnetic", "t1", "t2", "flair", "dwi"],
    "ultrasound": ["ultrasound", "us", "sonogram", "echo"],
    "pathology": ["pathology", "histology", "biopsy", "h&e", "ihc"],
    "dermoscopy": ["dermoscopy", "dermatoscopy", "skin", "lesion", "mole"],
    "fundus": ["fundus", "retina", "optic", "macula"],
    "oct": ["oct", "optical coherence"],
}


# Modality-specific analysis prompts
MODALITY_PROMPTS = {
    "xray": """Analyze this chest X-ray systematically. Report:
1. Technical Quality (rotation, inspiration, exposure)
2. Bony Structures (ribs, clavicles, spine)
3. Lungs (opacities, consolidation, effusion, pneumothorax)
4. Cardiac Silhouette (size, contour)
5. Mediastinum (width, contour, masses)
6. Diaphragm (position, costophrenic angles)
7. Soft Tissues

Clinical context: {context}""",

    "ct": """Analyze this CT scan systematically. Report:
1. Window Settings
2. Anatomy (normal vs abnormal)
3. Lesions (location, size, density, margins)
4. Enhancement Pattern
5. Comparison to priors if available

Clinical context: {context}""",

    "pathology": """Analyze this histopathology image. Report:
1. Tissue Type
2. Architecture (normal vs disrupted)
3. Cellular Features (atypia, mitoses, invasion)
4. Staining (H&E, special stains, IHC)
5. Most likely diagnosis

Clinical context: {context}""",

    "dermoscopy": """Analyze this dermoscopy image using ABCDE criteria:
1. Asymmetry
2. Border (irregular, poorly defined)
3. Color (multiple colors, blue-white veil)
4. Diameter (>6mm concerning)
5. Dermoscopic Structures (network, globules, streaks)

Clinical context: {context}""",

    "fundus": """Analyze this fundus photograph. Report:
1. Optic Disc (cup-to-disc ratio, pallor, swelling)
2. Macula (foveal reflex, deposits, hemorrhages)
3. Vessels (A/V ratio, crossing changes)
4. Retina (hemorrhages, exudates, lesions)

Clinical context: {context}""",

    "default": """Analyze this medical image. Report:
1. Image modality and body region
2. Technical quality
3. Normal structures
4. Abnormal findings
5. Impression and recommendations

Clinical context: {context}""",
}

# JSON output schema instruction appended to all image analysis prompts
JSON_OUTPUT_INSTRUCTION = """

Output ONLY valid JSON with this structure:
{
    "modality": "detected modality",
    "findings": ["finding 1", "finding 2"],
    "impression": "overall clinical impression",
    "differential_diagnoses": ["diagnosis 1", "diagnosis 2"],
    "confidence": 0.0-1.0,
    "recommendations": ["recommendation 1"]
}"""

# Lab report extraction prompt
LAB_EXTRACTION_PROMPT = """Extract all lab values from this lab report image.

Output ONLY valid JSON with this structure:
{
    "labs": [
        {
            "test": "test name",
            "value": "numeric or text value",
            "unit": "unit of measurement",
            "reference_range": "normal range",
            "flag": "normal|high|low|critical_high|critical_low"
        }
    ],
    "collection_date": "date if visible",
    "patient_info": "any visible patient identifiers (anonymized)"
}"""


class MedVisionClient:
    """Medical vision client using Modal-hosted MedGemma multimodal.

    Primary: MedGemma multimodal via Modal GPU
    Fallback: Text-only analysis via MedGemma text model
    """

    def __init__(self):
        self._modal_url = getattr(settings, 'medgemma_multimodal_modal_url', '') or ''
        self._modal_model = getattr(settings, 'medgemma_multimodal_modal_model', 'google/medgemma-27b-multimodal')

        # Fall back to the text-based Modal URL if multimodal URL not set
        if not self._modal_url:
            self._modal_url = getattr(settings, 'medgemma_modal_url', '') or ''
            if self._modal_url:
                self._modal_model = getattr(settings, 'medgemma_modal_model', 'google/medgemma-27b-it')
                logger.info("Vision client using text Modal endpoint (multimodal URL not configured)")

        if self._modal_url:
            logger.info(
                "MedVision client configured",
                modal_url=self._modal_url,
                modal_model=self._modal_model,
            )
        else:
            logger.warning("MedVision client: no Modal URL configured, will use text-only fallback")

    def _detect_modality(self, filename: str, context: str = "") -> str:
        """Detect image modality from filename and context."""
        combined = f"{filename.lower()} {context.lower()}"
        for modality, patterns in MODALITY_PATTERNS.items():
            if any(p in combined for p in patterns):
                return modality
        return "default"

    async def analyze_image(
        self,
        image_b64: str,
        clinical_context: str = "",
        modality: str | None = None,
        filename: str = "",
    ) -> dict[str, Any]:
        """Analyze a medical image with clinical context.

        Routes through specialized foundation models when available:
        - X-ray → CXR Foundation (zero-shot classification) + MedGemma narrative
        - Dermoscopy → Derm Foundation (risk assessment) + MedGemma narrative
        - Pathology → Path Foundation (tissue classification) + MedGemma narrative

        Args:
            image_b64: Base64-encoded image data
            clinical_context: Clinical history/question
            modality: Override detected modality
            filename: Original filename for modality detection

        Returns:
            Structured analysis result with foundation model scores when available
        """
        if modality is None:
            modality = self._detect_modality(filename, clinical_context)

        prompt_template = MODALITY_PROMPTS.get(modality, MODALITY_PROMPTS["default"])
        prompt = prompt_template.format(context=clinical_context or "None provided")
        prompt += JSON_OUTPUT_INSTRUCTION

        logger.info("Analyzing medical image", modality=modality, has_modal=bool(self._modal_url))

        if self._modal_url:
            result = await self._analyze_via_modal(image_b64, prompt, modality)
        else:
            result = await self._analyze_text_only(modality, clinical_context)

        # Route through specialized foundation models for enhanced analysis
        result = await self._enhance_with_foundation_models(result, image_b64, modality)

        return result

    async def _enhance_with_foundation_models(
        self,
        result: dict[str, Any],
        image_b64: str,
        modality: str,
    ) -> dict[str, Any]:
        """Enhance MedGemma analysis with specialized foundation model scores."""

        if modality == "xray":
            try:
                from src.medgemma.cxr_foundation import get_cxr_foundation_client

                cxr = get_cxr_foundation_client()
                if cxr.is_available:
                    cxr_result = await cxr.classify_zero_shot(image_b64)
                    if "error" not in cxr_result:
                        result["cxr_foundation"] = {
                            "classifications": cxr_result.get("classifications", []),
                            "model": "cxr-foundation",
                        }
                        logger.info("CXR Foundation enhanced analysis", n_conditions=len(cxr_result.get("classifications", [])))
            except Exception as e:
                logger.warning("CXR Foundation enhancement failed", error=str(e))

        elif modality == "dermoscopy":
            try:
                from src.medgemma.derm_foundation import get_derm_foundation_client

                derm = get_derm_foundation_client()
                if derm.is_available:
                    derm_result = await derm.classify(image_b64)
                    if "error" not in derm_result:
                        result["derm_foundation"] = {
                            "classifications": derm_result.get("classifications", []),
                            "top_diagnosis": derm_result.get("top_diagnosis", ""),
                            "overall_risk": derm_result.get("overall_risk", ""),
                            "malignancy_probability": derm_result.get("malignancy_probability", 0),
                            "model": "derm-foundation",
                        }
                        logger.info("Derm Foundation enhanced analysis", risk=derm_result.get("overall_risk"))
            except Exception as e:
                logger.warning("Derm Foundation enhancement failed", error=str(e))

        elif modality == "pathology":
            try:
                from src.medgemma.path_foundation import get_path_foundation_client

                path = get_path_foundation_client()
                if path.is_available:
                    path_result = await path.classify_tissue(image_b64)
                    if "error" not in path_result:
                        result["path_foundation"] = {
                            "classifications": path_result.get("classifications", []),
                            "tumor_probability": path_result.get("tumor_probability", 0),
                            "grade": path_result.get("grade", ""),
                            "tiles_analyzed": path_result.get("tiles_analyzed", 0),
                            "model": "path-foundation",
                        }
                        logger.info("Path Foundation enhanced analysis", grade=path_result.get("grade"))
            except Exception as e:
                logger.warning("Path Foundation enhancement failed", error=str(e))

        return result

    async def extract_lab_report(
        self,
        image_b64: str,
        filename: str = "",
    ) -> dict[str, Any]:
        """Extract structured lab values from a lab report image.

        Args:
            image_b64: Base64-encoded image of lab report
            filename: Original filename

        Returns:
            Structured lab values
        """
        logger.info("Extracting lab report", has_modal=bool(self._modal_url))

        if self._modal_url:
            result = await self._analyze_via_modal(image_b64, LAB_EXTRACTION_PROMPT, "lab_report")
        else:
            result = {
                "labs": [],
                "error": "Multimodal model not available — cannot extract labs from image",
                "model": "text_only_fallback",
            }

        return result

    async def _analyze_via_modal(
        self,
        image_b64: str,
        prompt: str,
        modality: str,
    ) -> dict[str, Any]:
        """Send image + prompt to Modal multimodal endpoint."""
        # Build the message with image content block
        # Ensure base64 has proper data URI prefix
        if not image_b64.startswith("data:"):
            image_b64 = f"data:image/png;base64,{image_b64}"

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": image_b64},
                    },
                    {
                        "type": "text",
                        "text": prompt,
                    },
                ],
            },
        ]

        payload = {
            "model": self._modal_model,
            "messages": messages,
            "max_tokens": 2048,
            "temperature": 0.2,
            "stream": False,
        }

        try:
            timeout = aiohttp.ClientTimeout(total=120)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self._modal_url}/v1/chat/completions",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                ) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error("Modal multimodal request failed", status=resp.status, body=body[:500])
                        return await self._analyze_text_only(modality, "")

                    data = await resp.json()
                    content = data["choices"][0]["message"]["content"]

                    logger.info(
                        "Modal multimodal response",
                        tokens=data.get("usage", {}),
                        length=len(content),
                    )

                    # Parse JSON from response
                    result = self._parse_json(content)
                    result["model"] = "medgemma_multimodal"
                    result.setdefault("modality", modality)
                    return result

        except Exception as e:
            logger.error("Modal multimodal call failed", error=str(e))
            return await self._analyze_text_only(modality, "")

    async def _analyze_text_only(
        self,
        modality: str,
        clinical_context: str,
    ) -> dict[str, Any]:
        """Fallback text-only analysis when multimodal is unavailable."""
        return {
            "modality": modality,
            "findings": [
                "Image analysis requires multimodal model — using text-based inference only",
                f"Detected modality: {modality}",
            ],
            "impression": f"Text-based analysis for {modality} image. Deploy multimodal model for full image interpretation.",
            "differential_diagnoses": [],
            "confidence": 0.3,
            "recommendations": [
                "Deploy MedGemma multimodal for actual image analysis",
                "Formal radiologist review recommended",
            ],
            "model": "text_only_fallback",
        }

    def _parse_json(self, response: str) -> dict[str, Any]:
        """Parse JSON from model response."""
        import re

        response = response.strip()

        # Remove markdown code blocks
        if "```json" in response:
            start = response.index("```json") + 7
            end = response.find("```", start)
            response = response[start:end].strip() if end > 0 else response[start:].strip()
        elif "```" in response:
            start = response.index("```") + 3
            end = response.find("```", start)
            response = response[start:end].strip() if end > 0 else response[start:].strip()

        # Clean thinking tokens
        response = re.sub(r"<unused\d+>", "", response)

        # Find JSON object
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

        # Fix trailing commas
        response = re.sub(r',\s*}', '}', response)
        response = re.sub(r',\s*]', ']', response)

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            logger.warning("Failed to parse vision JSON response", response_len=len(response))
            return {
                "raw_analysis": response,
                "structured": False,
            }

    @property
    def is_available(self) -> bool:
        """Check if vision analysis is available."""
        return bool(self._modal_url)


# Singleton instance
_vision_client: MedVisionClient | None = None


def get_vision_client() -> MedVisionClient:
    """Get or create vision client singleton."""
    global _vision_client
    if _vision_client is None:
        _vision_client = MedVisionClient()
    return _vision_client
