#!/bin/bash
# MedLit Agent Demo Script
# Starts all services for the MedGemma Impact Challenge demo

set -e

echo "=============================================="
echo "  MedLit Agent - MedGemma Impact Challenge"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if model exists
MODEL_PATH="./models/medgemma-1.5-4b-it"
if [ ! -d "$MODEL_PATH" ]; then
    echo -e "${YELLOW}MedGemma model not found. Downloading (~19GB)...${NC}"
    echo "This may take 10-30 minutes depending on your connection."
    ./scripts/download_model.sh
fi

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill -f "uvicorn.*8000" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
sleep 2

# Start PostgreSQL if not running (optional, works without it)
if command -v docker &> /dev/null; then
    echo "Starting PostgreSQL..."
    docker compose up -d postgres 2>/dev/null || true
fi

# Start API server
echo -e "${GREEN}Starting API server on port 8000...${NC}"
cd "$(dirname "$0")/.."
nohup python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000 > /tmp/medlit-api.log 2>&1 &
API_PID=$!

# Wait for MedGemma to load
echo "Loading MedGemma 1.5 4B model (this takes ~60 seconds on first run)..."
for i in {1..90}; do
    if grep -q "MedGemma model loaded" /tmp/medlit-api.log 2>/dev/null; then
        echo -e "${GREEN}MedGemma loaded successfully!${NC}"
        break
    fi
    sleep 1
    printf "."
done
echo ""

# Start dashboard
echo -e "${GREEN}Starting dashboard on port 3000...${NC}"
cd dashboard
nohup npm run dev > /tmp/medlit-dashboard.log 2>&1 &
DASHBOARD_PID=$!
sleep 5

echo ""
echo "=============================================="
echo -e "${GREEN}  Demo is ready!${NC}"
echo "=============================================="
echo ""
echo "  Dashboard:  http://localhost:3000"
echo "  API:        http://localhost:8000"
echo "  API Docs:   http://localhost:8000/docs"
echo ""
echo "  Logs:"
echo "    API:       tail -f /tmp/medlit-api.log"
echo "    Dashboard: tail -f /tmp/medlit-dashboard.log"
echo ""
echo "  To stop:    pkill -f uvicorn && pkill -f next"
echo ""
echo "Try asking: 'Is metformin effective for type 2 diabetes?'"
echo ""
