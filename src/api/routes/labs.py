"""API routes for lab report extraction."""

import base64
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
import structlog

from src.medgemma.vision import get_vision_client

logger = structlog.get_logger()
router = APIRouter(prefix="/api/labs", tags=["lab-extraction"])


class LabValue(BaseModel):
    """Single extracted lab value."""
    test: str = ""
    value: str = ""
    unit: str = ""
    reference_range: str = ""
    flag: str = "normal"  # normal|high|low|critical_high|critical_low


class LabExtractionResponse(BaseModel):
    """Response from lab report extraction."""
    labs: list[LabValue] = []
    collection_date: str = ""
    patient_info: str = ""
    model: str = ""
    error: str = ""


@router.post("/extract", response_model=LabExtractionResponse)
async def extract_lab_report(
    image: UploadFile = File(...),
):
    """Extract structured lab values from a lab report image.

    Accepts a photo/scan of a lab report and returns structured
    lab values with test names, values, units, reference ranges, and flags.
    """
    vision = get_vision_client()

    # Read and encode image
    image_data = await image.read()
    if len(image_data) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=413, detail="Image too large (max 20MB)")

    image_b64 = base64.b64encode(image_data).decode("utf-8")

    # Detect content type
    content_type = image.content_type or "image/png"
    image_b64_uri = f"data:{content_type};base64,{image_b64}"

    result = await vision.extract_lab_report(
        image_b64=image_b64_uri,
        filename=image.filename or "",
    )

    # Parse labs from result
    labs = []
    for lab in result.get("labs", []):
        if isinstance(lab, dict):
            labs.append(LabValue(
                test=lab.get("test", ""),
                value=str(lab.get("value", "")),
                unit=lab.get("unit", ""),
                reference_range=lab.get("reference_range", ""),
                flag=lab.get("flag", "normal"),
            ))

    return LabExtractionResponse(
        labs=labs,
        collection_date=result.get("collection_date", ""),
        patient_info=result.get("patient_info", ""),
        model=result.get("model", ""),
        error=result.get("error", ""),
    )
