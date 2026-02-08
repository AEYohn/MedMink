"""Modal deployment for MedGemma 27B inference via vLLM.

Serves MedGemma 27B on an A100 80GB GPU with an OpenAI-compatible API.
The backend calls this endpoint instead of running the 4B model locally.

Setup:
    1. Accept MedGemma license: https://huggingface.co/google/medgemma-27b-it
    2. Create Modal secret:
       modal secret create huggingface-secret HF_TOKEN=hf_YOUR_TOKEN_HERE
    3. Deploy:
       modal deploy modal_app.py
    4. Set the URL in .env:
       MEDGEMMA_MODAL_URL=https://YOUR_USERNAME--medgemma-27b-serve.modal.run

Usage:
    # Test locally before deploying
    modal run modal_app.py

    # Deploy for persistent serving
    modal deploy modal_app.py
"""

import subprocess

import modal

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MODEL_NAME = "google/medgemma-27b-it"
MODEL_REVISION = None  # Use latest
N_GPU = 1  # A100 80GB fits 27B in bf16
VLLM_PORT = 8000
MINUTES = 60

# ---------------------------------------------------------------------------
# Modal resources
# ---------------------------------------------------------------------------

app = modal.App("medgemma-27b")

hf_cache = modal.Volume.from_name("hf-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("vllm-cache", create_if_missing=True)

vllm_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.8.0-devel-ubuntu22.04", add_python="3.12"
    )
    .entrypoint([])
    .uv_pip_install(
        "vllm==0.13.0",
        "huggingface-hub==0.36.0",
    )
)

# ---------------------------------------------------------------------------
# vLLM web server
# ---------------------------------------------------------------------------


@app.function(
    image=vllm_image,
    gpu="H100",
    scaledown_window=15 * MINUTES,
    timeout=10 * MINUTES,
    volumes={
        "/root/.cache/huggingface": hf_cache,
        "/root/.cache/vllm": vllm_cache,
    },
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
@modal.concurrent(max_inputs=10)
@modal.web_server(port=VLLM_PORT, startup_timeout=10 * MINUTES)
def serve():
    cmd = [
        "vllm",
        "serve",
        MODEL_NAME,
        "--host",
        "0.0.0.0",
        "--port",
        str(VLLM_PORT),
        "--dtype",
        "bfloat16",
        "--max-model-len",
        "8192",
        "--tensor-parallel-size",
        str(N_GPU),
        "--enforce-eager",
        "--trust-remote-code",
        "--gpu-memory-utilization",
        "0.92",
        "--served-model-name",
        MODEL_NAME,
    ]

    if MODEL_REVISION:
        cmd += ["--revision", MODEL_REVISION]

    print("Starting vLLM:", " ".join(cmd))
    subprocess.Popen(" ".join(cmd), shell=True)


# ---------------------------------------------------------------------------
# Local test entrypoint: modal run modal_app.py
# ---------------------------------------------------------------------------


@app.local_entrypoint()
async def test():
    import json

    import aiohttp

    url = serve.get_web_url()
    print(f"Server URL: {url}")

    # Wait for health
    async with aiohttp.ClientSession(base_url=url) as session:
        print("Waiting for server health...")
        timeout = aiohttp.ClientTimeout(total=8 * MINUTES)
        async with session.get("/health", timeout=timeout) as resp:
            assert resp.status == 200, f"Health check failed: {resp.status}"
            print("Server healthy!")

        # Send a clinical test prompt
        messages = [
            {
                "role": "system",
                "content": "You are a clinical evidence synthesis assistant. Output ONLY JSON.",
            },
            {
                "role": "user",
                "content": (
                    "A 45-year-old male presents with acute chest pain radiating to the left arm. "
                    "Troponin elevated at 0.8 ng/mL. ECG shows ST elevation in leads II, III, aVF. "
                    "What is the most likely diagnosis and immediate management? "
                    'Respond as JSON: {"diagnosis": "...", "immediate_actions": ["..."]}'
                ),
            },
        ]

        payload = {
            "model": MODEL_NAME,
            "messages": messages,
            "max_tokens": 1024,
            "temperature": 0.2,
            "stream": False,
        }

        print("Sending test clinical query...")
        async with session.post(
            "/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as resp:
            data = await resp.json()
            content = data["choices"][0]["message"]["content"]
            print(f"\nResponse:\n{content}")
            print(f"\nUsage: {json.dumps(data.get('usage', {}), indent=2)}")
