"""Modal deployment for TxGemma (drug property prediction).

Google's TxGemma-9B-chat: Gemma 2-based model for therapeutic property prediction.
Accepts natural language drug names — no SMILES lookup needed.

Deploy:
    modal deploy modal_txgemma.py

Test locally:
    modal serve modal_txgemma.py
"""

import modal

app = modal.App("txgemma")

hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)

txgemma_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.8.0-devel-ubuntu22.04", add_python="3.12"
    )
    .entrypoint([])
    .pip_install(
        "vllm==0.8.5.post1",
        "transformers>=4.48.2,<5.0",
        "structlog==24.1.0",
    )
)


@app.function(
    image=txgemma_image,
    gpu="A10G",
    scaledown_window=300,
    timeout=600,
    secrets=[modal.Secret.from_name("huggingface-secret")],
    volumes={
        "/root/.cache/huggingface": hf_cache,
    },
)
@modal.asgi_app()
def serve():
    """FastAPI app serving TxGemma-9B-chat via vLLM."""
    import json
    import time

    import structlog
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field
    from vllm import LLM, SamplingParams

    logger = structlog.get_logger()
    api = FastAPI(title="TxGemma", version="1.0.0")

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Load TxGemma via vLLM
    logger.info("Loading TxGemma-9B-chat...")
    llm = LLM(
        model="google/txgemma-9b-chat",
        trust_remote_code=True,
        max_model_len=2048,
        gpu_memory_utilization=0.95,
        enforce_eager=True,
    )
    logger.info("TxGemma-9B-chat loaded successfully")

    class InteractionRequest(BaseModel):
        drug_a: str = Field(..., min_length=2)
        drug_b: str = Field(..., min_length=2)

    class ToxicityRequest(BaseModel):
        drug: str = Field(..., min_length=2)

    class PropertiesRequest(BaseModel):
        drug: str = Field(..., min_length=2)

    def query_txgemma(prompt: str, max_tokens: int = 1024) -> str:
        params = SamplingParams(temperature=0.2, max_tokens=max_tokens)
        outputs = llm.generate([prompt], params)
        return outputs[0].outputs[0].text.strip()

    @api.get("/health")
    async def health():
        return {"status": "ok", "model": "txgemma-9b-chat"}

    @api.post("/predict-interaction")
    async def predict_interaction(request: InteractionRequest):
        """Predict drug-drug interaction between two medications."""
        start = time.time()

        prompt = f"""You are a clinical pharmacologist. Predict the drug-drug interaction between {request.drug_a} and {request.drug_b}.

Output ONLY valid JSON:
{{
    "drug_a": "{request.drug_a}",
    "drug_b": "{request.drug_b}",
    "interaction_exists": true/false,
    "severity": "major|moderate|minor|none",
    "mechanism": "brief mechanism of interaction",
    "clinical_effect": "what could happen clinically",
    "recommendation": "clinical recommendation",
    "confidence": 0.0-1.0
}}"""

        try:
            response = query_txgemma(prompt)
            # Parse JSON from response
            result = _parse_json(response)
            result["model"] = "txgemma-9b-chat"
            result["processing_time"] = round(time.time() - start, 2)
            return result
        except Exception as e:
            logger.error("Interaction prediction failed", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))

    @api.post("/predict-toxicity")
    async def predict_toxicity(request: ToxicityRequest):
        """Predict toxicity profile for a drug."""
        start = time.time()

        prompt = f"""You are a toxicologist. Predict the toxicity profile of {request.drug}.

Output ONLY valid JSON:
{{
    "drug": "{request.drug}",
    "hepatotoxicity_risk": "high|moderate|low",
    "nephrotoxicity_risk": "high|moderate|low",
    "cardiotoxicity_risk": "high|moderate|low",
    "neurotoxicity_risk": "high|moderate|low",
    "hematologic_toxicity_risk": "high|moderate|low",
    "bbb_penetration": "high|moderate|low|unknown",
    "therapeutic_index": "narrow|moderate|wide",
    "key_toxicities": ["toxicity 1", "toxicity 2"],
    "monitoring_required": ["lab/test to monitor"],
    "confidence": 0.0-1.0
}}"""

        try:
            response = query_txgemma(prompt)
            result = _parse_json(response)
            result["model"] = "txgemma-9b-chat"
            result["processing_time"] = round(time.time() - start, 2)
            return result
        except Exception as e:
            logger.error("Toxicity prediction failed", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))

    @api.post("/predict-properties")
    async def predict_properties(request: PropertiesRequest):
        """Predict therapeutic properties of a drug."""
        start = time.time()

        prompt = f"""You are a pharmacologist. Predict the therapeutic properties of {request.drug}.

Output ONLY valid JSON:
{{
    "drug": "{request.drug}",
    "drug_class": "pharmacological class",
    "mechanism_of_action": "primary mechanism",
    "primary_targets": ["target 1", "target 2"],
    "absorption": "oral bioavailability description",
    "half_life": "elimination half-life",
    "metabolism": "primary metabolic pathway",
    "excretion": "primary route of elimination",
    "bbb_penetration": "yes|no|limited",
    "protein_binding": "percentage",
    "drug_interactions_risk": "high|moderate|low",
    "special_populations": {{
        "pregnancy_category": "category",
        "renal_adjustment": "needed|not_needed|caution",
        "hepatic_adjustment": "needed|not_needed|caution",
        "elderly_considerations": "brief note"
    }},
    "confidence": 0.0-1.0
}}"""

        try:
            response = query_txgemma(prompt)
            result = _parse_json(response)
            result["model"] = "txgemma-9b-chat"
            result["processing_time"] = round(time.time() - start, 2)
            return result
        except Exception as e:
            logger.error("Properties prediction failed", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))

    def _parse_json(text: str) -> dict:
        """Parse JSON from model response."""
        import re

        text = text.strip()
        # Remove code blocks
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.find("```", start)
            text = text[start:end].strip() if end > 0 else text[start:].strip()
        elif "```" in text:
            start = text.index("```") + 3
            end = text.find("```", start)
            text = text[start:end].strip() if end > 0 else text[start:].strip()

        # Find JSON object
        if "{" in text:
            start = text.index("{")
            depth = 0
            end = start
            for i, c in enumerate(text[start:], start):
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            if end > start:
                text = text[start:end]

        text = re.sub(r",\s*}", "}", text)
        text = re.sub(r",\s*]", "]", text)

        return json.loads(text)

    return api
