#!/usr/bin/env python3
"""Download demo datasets for MedLit Agent showcase."""

import json
import os
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data" / "datasets"
DATA_DIR.mkdir(parents=True, exist_ok=True)

def download_medmcqa():
    """Download MedMCQA dataset (medical MCQs)."""
    print("Downloading MedMCQA dataset...")
    try:
        from datasets import load_dataset

        # Load a small subset for demo
        dataset = load_dataset("openlifescienceai/medmcqa", split="validation[:100]")

        # Save as JSON
        output_file = DATA_DIR / "medmcqa_sample.json"
        samples = []
        for item in dataset:
            samples.append({
                "question": item["question"],
                "options": [item["opa"], item["opb"], item["opc"], item["opd"]],
                "correct": item["cop"],
                "subject": item["subject_name"],
                "topic": item["topic_name"],
                "explanation": item.get("exp", ""),
            })

        with open(output_file, "w") as f:
            json.dump(samples, f, indent=2)

        print(f"  Saved {len(samples)} samples to {output_file}")
        return True
    except Exception as e:
        print(f"  Error: {e}")
        return False

def download_pubmed_qa():
    """Download PubMedQA dataset."""
    print("Downloading PubMedQA dataset...")
    try:
        from datasets import load_dataset

        dataset = load_dataset("qiaojin/PubMedQA", "pqa_labeled", split="train[:50]")

        output_file = DATA_DIR / "pubmedqa_sample.json"
        samples = []
        for item in dataset:
            samples.append({
                "question": item["question"],
                "context": item["context"]["contexts"][0] if item["context"]["contexts"] else "",
                "long_answer": item["long_answer"],
                "final_decision": item["final_decision"],
            })

        with open(output_file, "w") as f:
            json.dump(samples, f, indent=2)

        print(f"  Saved {len(samples)} samples to {output_file}")
        return True
    except Exception as e:
        print(f"  Error: {e}")
        return False

def create_demo_questions():
    """Create curated demo questions for showcase."""
    print("Creating demo questions...")

    demo_questions = [
        {
            "category": "Cardiology",
            "question": "What is the evidence for SGLT2 inhibitors in heart failure with preserved ejection fraction?",
            "pico": {
                "population": "Adults with heart failure with preserved ejection fraction (HFpEF)",
                "intervention": "SGLT2 inhibitors (empagliflozin, dapagliflozin)",
                "comparison": "Placebo or standard care",
                "outcome": "Hospitalization for heart failure, cardiovascular death"
            }
        },
        {
            "category": "Neurology",
            "question": "Does metformin reduce dementia risk in patients with type 2 diabetes?",
            "pico": {
                "population": "Adults with type 2 diabetes mellitus",
                "intervention": "Metformin therapy",
                "comparison": "Other antidiabetic medications or no metformin",
                "outcome": "Incidence of dementia or cognitive decline"
            }
        },
        {
            "category": "Oncology",
            "question": "What is the efficacy of checkpoint inhibitors in triple-negative breast cancer?",
            "pico": {
                "population": "Patients with triple-negative breast cancer",
                "intervention": "Immune checkpoint inhibitors (pembrolizumab, atezolizumab)",
                "comparison": "Chemotherapy alone",
                "outcome": "Overall survival, progression-free survival"
            }
        },
        {
            "category": "Psychiatry",
            "question": "What are first-line treatments for treatment-resistant depression?",
            "pico": {
                "population": "Adults with major depressive disorder not responding to 2+ antidepressants",
                "intervention": "Augmentation strategies (lithium, atypical antipsychotics, ketamine)",
                "comparison": "Switching antidepressants",
                "outcome": "Response rate, remission rate"
            }
        },
        {
            "category": "Infectious Disease",
            "question": "Is early antiviral treatment effective for COVID-19 in high-risk patients?",
            "pico": {
                "population": "High-risk adults with early COVID-19 infection",
                "intervention": "Paxlovid (nirmatrelvir/ritonavir) or molnupiravir",
                "comparison": "Placebo or supportive care",
                "outcome": "Hospitalization, death"
            }
        },
        {
            "category": "Endocrinology",
            "question": "What is the role of GLP-1 agonists in obesity management?",
            "pico": {
                "population": "Adults with obesity (BMI ≥30) or overweight with comorbidities",
                "intervention": "GLP-1 receptor agonists (semaglutide, liraglutide, tirzepatide)",
                "comparison": "Lifestyle modification alone or placebo",
                "outcome": "Weight loss, cardiovascular outcomes"
            }
        },
    ]

    output_file = DATA_DIR / "demo_questions.json"
    with open(output_file, "w") as f:
        json.dump(demo_questions, f, indent=2)

    print(f"  Saved {len(demo_questions)} demo questions to {output_file}")
    return True

def create_sample_papers():
    """Create sample paper metadata for demo."""
    print("Creating sample papers database...")

    sample_papers = [
        {
            "pmid": "36356033",
            "title": "Empagliflozin in Heart Failure with a Preserved Ejection Fraction",
            "authors": ["Anker SD", "Butler J", "Filippatos G"],
            "journal": "N Engl J Med",
            "year": 2021,
            "abstract": "SGLT2 inhibitors reduce the risk of hospitalization for heart failure...",
            "mesh_terms": ["Heart Failure", "SGLT2 Inhibitors", "Empagliflozin"],
            "doi": "10.1056/NEJMoa2107038"
        },
        {
            "pmid": "35298676",
            "title": "Tirzepatide Once Weekly for the Treatment of Obesity",
            "authors": ["Jastreboff AM", "Aronne LJ", "Ahmad NN"],
            "journal": "N Engl J Med",
            "year": 2022,
            "abstract": "Tirzepatide, a dual GIP and GLP-1 receptor agonist, showed substantial weight loss...",
            "mesh_terms": ["Obesity", "GLP-1", "Tirzepatide", "Weight Loss"],
            "doi": "10.1056/NEJMoa2206038"
        },
        {
            "pmid": "33882206",
            "title": "Pembrolizumab plus Chemotherapy in Advanced Triple-Negative Breast Cancer",
            "authors": ["Cortes J", "Cescon DW", "Rugo HS"],
            "journal": "N Engl J Med",
            "year": 2022,
            "abstract": "Adding pembrolizumab to chemotherapy significantly improved outcomes in TNBC...",
            "mesh_terms": ["Breast Cancer", "Immunotherapy", "Pembrolizumab"],
            "doi": "10.1056/NEJMoa2202809"
        },
    ]

    output_file = DATA_DIR / "sample_papers.json"
    with open(output_file, "w") as f:
        json.dump(sample_papers, f, indent=2)

    print(f"  Saved {len(sample_papers)} sample papers to {output_file}")
    return True

def download_sample_xrays():
    """Download sample chest X-ray images for demo."""
    print("Downloading sample medical images...")

    images_dir = DATA_DIR / "images"
    images_dir.mkdir(exist_ok=True)

    # Note: In production, you'd download from CheXpert or NIH ChestX-ray
    # For demo, we'll create placeholder info
    image_info = [
        {
            "filename": "chest_xray_normal.png",
            "description": "Normal chest X-ray",
            "modality": "X-ray",
            "body_part": "Chest",
            "finding": "No acute cardiopulmonary abnormality"
        },
        {
            "filename": "chest_xray_pneumonia.png",
            "description": "Chest X-ray with pneumonia",
            "modality": "X-ray",
            "body_part": "Chest",
            "finding": "Right lower lobe consolidation consistent with pneumonia"
        },
        {
            "filename": "ct_brain_normal.png",
            "description": "Normal brain CT",
            "modality": "CT",
            "body_part": "Brain",
            "finding": "No acute intracranial abnormality"
        },
    ]

    output_file = images_dir / "image_manifest.json"
    with open(output_file, "w") as f:
        json.dump(image_info, f, indent=2)

    print(f"  Created image manifest at {output_file}")
    print("  Note: Download actual images from CheXpert or NIH ChestX-ray8 for full demo")
    return True

def main():
    print("=" * 60)
    print("MedLit Agent - Dataset Downloader")
    print("=" * 60)
    print()

    results = {
        "MedMCQA": download_medmcqa(),
        "PubMedQA": download_pubmed_qa(),
        "Demo Questions": create_demo_questions(),
        "Sample Papers": create_sample_papers(),
        "Medical Images": download_sample_xrays(),
    }

    print()
    print("=" * 60)
    print("Summary:")
    print("=" * 60)
    for name, success in results.items():
        status = "✓" if success else "✗"
        print(f"  {status} {name}")

    print()
    print(f"Data saved to: {DATA_DIR}")
    print()

if __name__ == "__main__":
    main()
