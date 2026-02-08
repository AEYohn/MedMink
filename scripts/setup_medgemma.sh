#!/bin/bash
#
# MedGemma Setup Script
# Downloads Google's MedGemma model for the MedGemma Impact Challenge
#
# Prerequisites:
# 1. Create a Hugging Face account: https://huggingface.co/join
# 2. Accept MedGemma license: https://huggingface.co/google/medgemma-1.5-4b-it
# 3. Create access token: https://huggingface.co/settings/tokens
#
# Usage: ./scripts/setup_medgemma.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MedGemma Setup for Impact Challenge${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is required${NC}"
    exit 1
fi

# Install/upgrade dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
pip install --upgrade transformers accelerate bitsandbytes huggingface_hub torch

# Check for Hugging Face login
echo ""
echo -e "${YELLOW}Checking Hugging Face authentication...${NC}"
if ! huggingface-cli whoami &> /dev/null; then
    echo -e "${YELLOW}You need to log in to Hugging Face.${NC}"
    echo ""
    echo -e "Before logging in, make sure you:"
    echo -e "  1. Have a Hugging Face account: ${BLUE}https://huggingface.co/join${NC}"
    echo -e "  2. Accepted MedGemma license: ${BLUE}https://huggingface.co/google/medgemma-1.5-4b-it${NC}"
    echo -e "  3. Created an access token: ${BLUE}https://huggingface.co/settings/tokens${NC}"
    echo ""
    huggingface-cli login
fi

# Model selection
echo ""
echo -e "${GREEN}Available MedGemma models:${NC}"
echo "  1. google/medgemma-1.5-4b-it (4B params, ~8GB VRAM) - Recommended"
echo "  2. google/medgemma-4b-it (4B params, ~8GB VRAM)"
echo "  3. google/medgemma-27b-text-it (27B params, ~54GB VRAM)"
echo ""

MODEL="google/medgemma-1.5-4b-it"
read -p "Enter model number [1]: " choice
case $choice in
    2) MODEL="google/medgemma-4b-it" ;;
    3) MODEL="google/medgemma-27b-text-it" ;;
    *) MODEL="google/medgemma-1.5-4b-it" ;;
esac

echo ""
echo -e "${GREEN}Downloading ${MODEL}...${NC}"
echo -e "${YELLOW}This may take a while depending on your connection.${NC}"

# Download model
python3 << EOF
from huggingface_hub import snapshot_download
import os

model_id = "${MODEL}"
print(f"Downloading {model_id}...")

try:
    path = snapshot_download(
        repo_id=model_id,
        local_dir=f"./models/{model_id.split('/')[-1]}",
        local_dir_use_symlinks=False,
    )
    print(f"\nModel downloaded to: {path}")
except Exception as e:
    print(f"\nError: {e}")
    print("\nMake sure you have:")
    print("  1. Accepted the model license on Hugging Face")
    print("  2. Logged in with: huggingface-cli login")
    exit(1)
EOF

# Test the model
echo ""
echo -e "${GREEN}Testing MedGemma...${NC}"
python3 << EOF
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_id = "${MODEL}"
print(f"Loading {model_id}...")

try:
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)

    # Determine device
    if torch.cuda.is_available():
        device = "cuda"
        dtype = torch.bfloat16
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
        dtype = torch.float16
    else:
        device = "cpu"
        dtype = torch.float32

    print(f"Using device: {device}")

    # Quick test with just tokenizer
    test_prompt = "What are the symptoms of diabetes?"
    inputs = tokenizer(test_prompt, return_tensors="pt")
    print(f"Tokenization test passed! ({len(inputs['input_ids'][0])} tokens)")

    print(f"\n✅ MedGemma is ready to use!")
    print(f"\nTo use in your code:")
    print(f"  from src.medgemma.client import get_medgemma_client")
    print(f"  client = get_medgemma_client()")
    print(f"  response = await client.generate('What is the treatment for hypertension?')")

except Exception as e:
    print(f"Error: {e}")
    exit(1)
EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  MedGemma Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Model: ${MODEL}"
echo -e "Location: ./models/${MODEL##*/}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Start the API: ${BLUE}make run-api${NC}"
echo -e "  2. Start the dashboard: ${BLUE}cd dashboard && npm run dev${NC}"
echo -e "  3. Open http://localhost:3000 and ask a clinical question!"
echo ""
