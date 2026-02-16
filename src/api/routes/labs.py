"""API routes for lab report extraction."""

import base64

import fitz  # pymupdf
import structlog
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

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


def pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    """Render each PDF page as a PNG image."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in doc:
        pix = page.get_pixmap(dpi=200)
        images.append(pix.tobytes("png"))
    doc.close()
    return images


def _parse_labs(result: dict) -> list[LabValue]:
    """Parse lab values from a vision extraction result."""
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
    return labs


@router.post("/extract", response_model=LabExtractionResponse)
async def extract_lab_report(
    image: UploadFile = File(...),
):
    """Extract structured lab values from a lab report image or PDF.

    Accepts a photo/scan of a lab report or a multi-page PDF and returns
    structured lab values with test names, values, units, reference ranges,
    and flags.
    """
    vision = get_vision_client()

    # Read file
    file_data = await image.read()
    if len(file_data) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=413, detail="File too large (max 20MB)")

    content_type = image.content_type or "image/png"

    # PDF: convert each page to an image, extract from each, merge results
    if content_type == "application/pdf":
        try:
            page_images = pdf_to_images(file_data)
        except Exception as exc:
            logger.error("pdf_conversion_failed", error=str(exc))
            raise HTTPException(status_code=400, detail="Failed to read PDF") from exc

        all_labs: list[LabValue] = []
        collection_date = ""
        patient_info = ""
        model = ""

        for i, png_bytes in enumerate(page_images):
            page_b64 = base64.b64encode(png_bytes).decode("utf-8")
            page_uri = f"data:image/png;base64,{page_b64}"
            result = await vision.extract_lab_report(
                image_b64=page_uri,
                filename=f"{image.filename or 'page'}_{i + 1}.png",
            )
            page_labs = _parse_labs(result)
            # Deduplicate by test name (keep later page if duplicate)
            existing_tests = {l.test.lower() for l in all_labs}
            for lab in page_labs:
                if lab.test.lower() not in existing_tests:
                    all_labs.append(lab)
                    existing_tests.add(lab.test.lower())
            if not collection_date:
                collection_date = result.get("collection_date", "")
            if not patient_info:
                patient_info = result.get("patient_info", "")
            if not model:
                model = result.get("model", "")

        return LabExtractionResponse(
            labs=all_labs,
            collection_date=collection_date,
            patient_info=patient_info,
            model=model,
            error="",
        )

    # Image: existing flow
    image_b64 = base64.b64encode(file_data).decode("utf-8")
    image_b64_uri = f"data:{content_type};base64,{image_b64}"

    result = await vision.extract_lab_report(
        image_b64=image_b64_uri,
        filename=image.filename or "",
    )

    return LabExtractionResponse(
        labs=_parse_labs(result),
        collection_date=result.get("collection_date", ""),
        patient_info=result.get("patient_info", ""),
        model=result.get("model", ""),
        error=result.get("error", ""),
    )
