"""Seed embedding store with sample teaching cases.

Usage:
    python -m scripts.seed_embeddings [--modality cxr|derm|pathology]

Loads sample images from data/sample_cases/, computes embeddings via
Modal foundation model endpoints, and stores in data/embeddings/.
"""

import asyncio
import base64
import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.medgemma.embedding_store import get_embedding_store

# Sample teaching cases with metadata
# These represent common diagnoses for each modality
SAMPLE_CASES = {
    "cxr": [
        {"case_id": "cxr_pneumothorax_01", "diagnosis": "Right-sided pneumothorax", "description": "Large right-sided pneumothorax with visible visceral pleural line and absent lung markings"},
        {"case_id": "cxr_pleural_effusion_01", "diagnosis": "Bilateral pleural effusions", "description": "Bilateral meniscus sign with blunting of costophrenic angles"},
        {"case_id": "cxr_cardiomegaly_01", "diagnosis": "Cardiomegaly with pulmonary edema", "description": "Enlarged cardiac silhouette with bilateral pulmonary edema and Kerley B lines"},
        {"case_id": "cxr_pneumonia_rll_01", "diagnosis": "Right lower lobe pneumonia", "description": "Right lower lobe consolidation with air bronchograms"},
        {"case_id": "cxr_pneumonia_lll_01", "diagnosis": "Left lower lobe pneumonia", "description": "Left lower lobe consolidation behind the heart"},
        {"case_id": "cxr_chf_01", "diagnosis": "Congestive heart failure", "description": "Cardiomegaly, cephalization of vessels, bilateral effusions"},
        {"case_id": "cxr_atelectasis_01", "diagnosis": "Left lower lobe atelectasis", "description": "Left lower lobe volume loss with shift of mediastinum"},
        {"case_id": "cxr_rib_fracture_01", "diagnosis": "Multiple rib fractures", "description": "Fractures of right ribs 4-7 with small hemothorax"},
        {"case_id": "cxr_nodule_01", "diagnosis": "Solitary pulmonary nodule", "description": "2cm solitary pulmonary nodule in right upper lobe"},
        {"case_id": "cxr_normal_01", "diagnosis": "Normal chest X-ray", "description": "Normal cardiac silhouette, clear lung fields, no effusions"},
    ],
    "derm": [
        {"case_id": "derm_melanoma_01", "diagnosis": "Melanoma", "description": "Asymmetric pigmented lesion with irregular borders and color variation"},
        {"case_id": "derm_basal_cell_01", "diagnosis": "Basal cell carcinoma", "description": "Pearly papule with telangiectasia and rolled borders"},
        {"case_id": "derm_squamous_cell_01", "diagnosis": "Squamous cell carcinoma", "description": "Keratotic nodule with central ulceration"},
        {"case_id": "derm_nevus_01", "diagnosis": "Benign melanocytic nevus", "description": "Symmetric, well-circumscribed pigmented lesion"},
        {"case_id": "derm_seborrheic_01", "diagnosis": "Seborrheic keratosis", "description": "Stuck-on waxy plaque with horn pseudocysts"},
        {"case_id": "derm_dermatofibroma_01", "diagnosis": "Dermatofibroma", "description": "Firm brown papule with positive dimple sign"},
        {"case_id": "derm_actinic_01", "diagnosis": "Actinic keratosis", "description": "Rough, scaly patch on sun-exposed skin"},
        {"case_id": "derm_psoriasis_01", "diagnosis": "Psoriasis plaque", "description": "Well-demarcated erythematous plaque with silvery scale"},
    ],
    "pathology": [
        {"case_id": "path_adenocarcinoma_01", "diagnosis": "Lung adenocarcinoma", "description": "Glandular pattern with nuclear atypia, Grade 2"},
        {"case_id": "path_squamous_lung_01", "diagnosis": "Lung squamous cell carcinoma", "description": "Keratinizing squamous cells with intercellular bridges"},
        {"case_id": "path_breast_idc_01", "diagnosis": "Breast invasive ductal carcinoma", "description": "Irregular nests of malignant cells invading stroma"},
        {"case_id": "path_colon_adeno_01", "diagnosis": "Colon adenocarcinoma", "description": "Malignant glands invading through muscularis propria"},
        {"case_id": "path_normal_lung_01", "diagnosis": "Normal lung tissue", "description": "Normal alveolar architecture with thin septa"},
        {"case_id": "path_inflammation_01", "diagnosis": "Chronic inflammation", "description": "Dense lymphocytic infiltrate with fibrosis"},
    ],
}


async def seed_modality(modality: str):
    """Seed embeddings for a specific modality."""
    cases = SAMPLE_CASES.get(modality, [])
    if not cases:
        print(f"No sample cases defined for modality: {modality}")
        return

    sample_dir = Path(f"data/sample_cases/{modality}")
    if not sample_dir.exists():
        print(f"Sample directory not found: {sample_dir}")
        print(f"Create {sample_dir}/ and add sample images to seed embeddings.")
        print(f"Seeding {len(cases)} cases with synthetic embeddings for demo...")

        # For demo: generate random embeddings so the UI has something to show
        store = get_embedding_store(modality)
        import numpy as np

        # Use consistent random seeds per case for reproducibility
        for case in cases:
            seed = hash(case["case_id"]) % (2**32)
            rng = np.random.RandomState(seed)

            # CXR embeddings are typically 1376-dim, derm 6144-dim, path 768-dim
            dim_map = {"cxr": 1376, "derm": 6144, "pathology": 768}
            dim = dim_map.get(modality, 768)
            embedding = rng.randn(dim).tolist()

            store.add(
                case_id=case["case_id"],
                embedding=embedding,
                metadata={
                    "diagnosis": case["diagnosis"],
                    "description": case["description"],
                    "source": "synthetic_demo",
                },
            )
            print(f"  Added: {case['case_id']} — {case['diagnosis']}")

        print(f"Seeded {len(cases)} synthetic embeddings for {modality}")
        return

    # Real seeding with actual images
    if modality == "cxr":
        from src.medgemma.cxr_foundation import get_cxr_foundation_client
        client = get_cxr_foundation_client()
    elif modality == "derm":
        from src.medgemma.derm_foundation import get_derm_foundation_client
        client = get_derm_foundation_client()
    elif modality == "pathology":
        from src.medgemma.path_foundation import get_path_foundation_client
        client = get_path_foundation_client()
    else:
        print(f"Unknown modality: {modality}")
        return

    if not client.is_available:
        print(f"Modal endpoint not configured for {modality}. Using synthetic embeddings.")
        return

    store = get_embedding_store(modality)
    for case in cases:
        image_path = sample_dir / f"{case['case_id']}.png"
        if not image_path.exists():
            image_path = sample_dir / f"{case['case_id']}.jpg"
        if not image_path.exists():
            print(f"  Skipping {case['case_id']}: no image found")
            continue

        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode()

        print(f"  Computing embedding for {case['case_id']}...")
        result = await client.get_embedding(image_b64)
        if "error" in result:
            print(f"  Error: {result['error']}")
            continue

        embedding = result.get("embedding", [])
        if not embedding:
            print(f"  No embedding returned for {case['case_id']}")
            continue

        store.add(
            case_id=case["case_id"],
            embedding=embedding,
            metadata={
                "diagnosis": case["diagnosis"],
                "description": case["description"],
                "source": "foundation_model",
            },
        )
        print(f"  Added: {case['case_id']} — {case['diagnosis']}")

    print(f"Seeded {store.count} embeddings for {modality}")


async def main():
    modalities = ["cxr", "derm", "pathology"]

    if len(sys.argv) > 2 and sys.argv[1] == "--modality":
        modalities = [sys.argv[2]]

    for modality in modalities:
        print(f"\n=== Seeding {modality} embeddings ===")
        await seed_modality(modality)

    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
