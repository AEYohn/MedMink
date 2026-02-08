#!/bin/bash
#
# MedGemma Model Download Script
# Downloads and sets up MedGemma 4B quantized model for local inference
#
# Usage: ./scripts/download_model.sh
#
# Requirements:
#   - Python 3.12+
#   - huggingface_hub installed (pip install huggingface_hub)
#   - ~3GB disk space for the quantized model
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  MedGemma Model Download Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
MODEL_DIR="./models"
MODEL_NAME="medgemma-4b-it-Q4_K_M.gguf"
HUGGINGFACE_REPO="TheBloke/medgemma-4b-it-GGUF"

# Check if model already exists
if [ -f "${MODEL_DIR}/${MODEL_NAME}" ]; then
    echo -e "${YELLOW}Model already exists at ${MODEL_DIR}/${MODEL_NAME}${NC}"
    read -p "Do you want to re-download? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        exit 0
    fi
fi

# Create models directory
echo -e "${GREEN}Creating models directory...${NC}"
mkdir -p "${MODEL_DIR}"

# Check for huggingface_hub
echo -e "${GREEN}Checking for huggingface_hub...${NC}"
if ! python3 -c "import huggingface_hub" 2>/dev/null; then
    echo -e "${YELLOW}Installing huggingface_hub...${NC}"
    pip install huggingface_hub
fi

# Download model
echo ""
echo -e "${GREEN}Downloading MedGemma 4B quantized model...${NC}"
echo -e "${YELLOW}This may take several minutes depending on your connection.${NC}"
echo ""

python3 << EOF
from huggingface_hub import hf_hub_download
import os

model_dir = "${MODEL_DIR}"
model_name = "${MODEL_NAME}"
repo_id = "${HUGGINGFACE_REPO}"

print(f"Downloading {model_name} from {repo_id}...")

try:
    # Download the model file
    downloaded_path = hf_hub_download(
        repo_id=repo_id,
        filename=model_name,
        local_dir=model_dir,
        local_dir_use_symlinks=False,
    )
    print(f"\nModel downloaded successfully to: {downloaded_path}")
except Exception as e:
    # If the exact model name doesn't exist, try alternative
    print(f"Could not find {model_name}, trying alternative quantization...")
    alternatives = [
        "medgemma-4b-it.Q4_K_M.gguf",
        "medgemma-4b-instruct-Q4_K_M.gguf",
        "medgemma-4b-it-q4_k_m.gguf",
    ]

    for alt in alternatives:
        try:
            downloaded_path = hf_hub_download(
                repo_id=repo_id,
                filename=alt,
                local_dir=model_dir,
                local_dir_use_symlinks=False,
            )
            # Rename to expected name
            os.rename(
                os.path.join(model_dir, alt),
                os.path.join(model_dir, model_name)
            )
            print(f"\nModel downloaded and renamed to: {model_name}")
            break
        except:
            continue
    else:
        print(f"\nError: Could not download model. Error: {e}")
        print("\nPlease check the HuggingFace repository for available files:")
        print(f"  https://huggingface.co/{repo_id}")
        exit(1)
EOF

# Verify download
if [ -f "${MODEL_DIR}/${MODEL_NAME}" ]; then
    SIZE=$(du -h "${MODEL_DIR}/${MODEL_NAME}" | cut -f1)
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Download Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "Model: ${MODEL_NAME}"
    echo -e "Size:  ${SIZE}"
    echo -e "Path:  ${MODEL_DIR}/${MODEL_NAME}"
    echo ""
    echo -e "${GREEN}To test the model:${NC}"
    echo "  python -c \"from src.medgemma.client import MedGemmaClient; client = MedGemmaClient(); print(client.is_available)\""
    echo ""
else
    echo -e "${RED}Error: Model file not found after download.${NC}"
    exit 1
fi

# Create a symlink for easier access (optional)
if [ ! -L "${MODEL_DIR}/medgemma.gguf" ]; then
    echo -e "${GREEN}Creating convenience symlink...${NC}"
    ln -sf "${MODEL_NAME}" "${MODEL_DIR}/medgemma.gguf"
fi

echo -e "${GREEN}Setup complete!${NC}"
