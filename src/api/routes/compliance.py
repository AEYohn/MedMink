"""API routes for SOAP note compliance scanning."""

from dataclasses import asdict
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.medgemma.compliance_engine import (
    TOTAL_RULES,
    ComplianceFlag,
    compute_compliance_score,
    generate_ai_fix,
    run_deterministic_validation,
    scan_compliance,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/api/compliance", tags=["compliance"])


class ScanRequest(BaseModel):
    soap: dict[str, Any]
    patient_context: str | None = None


class FixRequest(BaseModel):
    soap: dict[str, Any]
    flag: dict[str, Any]


@router.post("/scan")
async def compliance_scan(request: ScanRequest):
    """Full compliance scan: deterministic + AI validation."""
    try:
        result = await scan_compliance(request.soap, include_ai=True)
        return {
            "score": result.score,
            "grade": result.grade,
            "flags": [asdict(f) for f in result.flags],
            "claim_denial_score": result.claim_denial_score,
            "malpractice_score": result.malpractice_score,
            "rules_checked": result.rules_checked,
            "rules_passed": result.rules_passed,
        }
    except Exception as e:
        logger.error("Compliance scan failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/scan/quick")
async def compliance_scan_quick(request: ScanRequest):
    """Quick compliance scan: deterministic rules only (no AI)."""
    try:
        flags = run_deterministic_validation(request.soap)
        result = compute_compliance_score(flags, TOTAL_RULES)
        return {
            "score": result.score,
            "grade": result.grade,
            "flags": [asdict(f) for f in result.flags],
            "claim_denial_score": result.claim_denial_score,
            "malpractice_score": result.malpractice_score,
            "rules_checked": result.rules_checked,
            "rules_passed": result.rules_passed,
        }
    except Exception as e:
        logger.error("Quick compliance scan failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/fix")
async def compliance_fix(request: FixRequest):
    """Generate AI fix for a specific compliance flag."""
    try:
        flag = ComplianceFlag(
            severity=request.flag.get("severity", "warning"),
            domain=request.flag.get("domain", ""),
            section=request.flag.get("section", ""),
            field=request.flag.get("field", ""),
            rule_id=request.flag.get("rule_id", ""),
            message=request.flag.get("message", ""),
            auto_fixable=request.flag.get("auto_fixable", True),
            suggested_fix=request.flag.get("suggested_fix", ""),
            reference=request.flag.get("reference", ""),
        )

        # If there's a pre-computed deterministic fix, return it
        if flag.suggested_fix:
            return {
                "fixed_text": flag.suggested_fix,
                "field_path": flag.field,
            }

        # Otherwise generate AI fix
        fixed_text = await generate_ai_fix(request.soap, flag)
        if not fixed_text:
            raise HTTPException(status_code=422, detail="Could not generate fix")

        return {
            "fixed_text": fixed_text,
            "field_path": flag.field,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Compliance fix failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e
