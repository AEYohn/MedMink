"""EMS Run Report storage — JSON file-based persistence.

Follows the visit_tracker.py pattern: JSON files at data/ems_runs/.
Each run is stored as an individual JSON file keyed by run_id.
"""

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

import structlog

from src.medgemma.ems_models import EMSRunReport, compute_section_completeness

logger = structlog.get_logger()

RUNS_DIR = Path("data/ems_runs")


class EMSStorage:
    """Persists EMS run reports as JSON files."""

    def __init__(self, storage_dir: Path | None = None):
        self._storage_dir = storage_dir or RUNS_DIR
        self._storage_dir.mkdir(parents=True, exist_ok=True)

    def _run_file(self, run_id: str) -> Path:
        safe_id = run_id.replace("/", "_").replace("\\", "_")
        return self._storage_dir / f"{safe_id}.json"

    def save_run(self, report: EMSRunReport) -> dict[str, Any]:
        """Save or update a run report."""
        report.section_completeness = compute_section_completeness(report)
        data = asdict(report)
        filepath = self._run_file(report.run_id)
        filepath.write_text(json.dumps(data, indent=2, default=str))
        logger.info("EMS run saved", run_id=report.run_id, status=report.status)
        return data

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        """Get a run report by ID."""
        filepath = self._run_file(run_id)
        if not filepath.exists():
            return None
        try:
            return json.loads(filepath.read_text())
        except Exception as e:
            logger.error("Failed to read EMS run", run_id=run_id, error=str(e))
            return None

    def list_runs(self, limit: int = 50) -> list[dict[str, Any]]:
        """List all run reports, newest first."""
        runs = []
        for filepath in self._storage_dir.glob("*.json"):
            try:
                data = json.loads(filepath.read_text())
                runs.append(
                    {
                        "run_id": data.get("run_id", ""),
                        "session_id": data.get("session_id", ""),
                        "status": data.get("status", "draft"),
                        "created_at": data.get("created_at", ""),
                        "updated_at": data.get("updated_at", ""),
                        "chief_complaint": data.get("patient", {}).get("chief_complaint", ""),
                        "section_completeness": data.get("section_completeness", {}),
                    }
                )
            except Exception:
                continue
        runs.sort(key=lambda r: r.get("updated_at", ""), reverse=True)
        return runs[:limit]

    def update_section(
        self, run_id: str, section: str, data: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Update a specific section of a run report."""
        filepath = self._run_file(run_id)
        if not filepath.exists():
            return None
        try:
            run_data = json.loads(filepath.read_text())
            if section in run_data and isinstance(run_data[section], dict):
                run_data[section].update(data)
            else:
                run_data[section] = data
            from datetime import datetime

            run_data["updated_at"] = datetime.utcnow().isoformat()
            filepath.write_text(json.dumps(run_data, indent=2, default=str))
            return run_data
        except Exception as e:
            logger.error(
                "Failed to update EMS run section", run_id=run_id, section=section, error=str(e)
            )
            return None


# Singleton
_ems_storage: EMSStorage | None = None


def get_ems_storage() -> EMSStorage:
    global _ems_storage
    if _ems_storage is None:
        _ems_storage = EMSStorage()
    return _ems_storage
