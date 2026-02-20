"""Structured output schemas for Gemini API."""

from typing import Any

# Paper Analysis Schema
PaperAnalysisSchema: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "description": "A concise summary of the paper's main contribution (2-3 sentences)",
        },
        "claims": {
            "type": "array",
            "description": "Key claims made in the paper",
            "items": {
                "type": "object",
                "properties": {
                    "statement": {
                        "type": "string",
                        "description": "The claim statement",
                    },
                    "category": {
                        "type": "string",
                        "enum": [
                            "performance",
                            "methodology",
                            "theoretical",
                            "empirical",
                            "limitation",
                        ],
                        "description": "Category of the claim",
                    },
                    "confidence": {
                        "type": "number",
                        "description": "Confidence in the claim (0-1)",
                    },
                    "evidence": {
                        "type": "string",
                        "description": "Supporting evidence from the paper",
                    },
                },
                "required": ["statement", "category", "confidence"],
            },
        },
        "methods": {
            "type": "array",
            "description": "Methods or techniques introduced or used",
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name of the method/technique",
                    },
                    "description": {
                        "type": "string",
                        "description": "Brief description of the method",
                    },
                    "is_novel": {
                        "type": "boolean",
                        "description": "Whether this is a novel contribution",
                    },
                },
                "required": ["name", "description", "is_novel"],
            },
        },
        "techniques": {
            "type": "array",
            "description": "Specific techniques, algorithms, or mathematical formulations",
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name of the technique/algorithm (e.g., 'Attention Mechanism', 'Adam Optimizer')",
                    },
                    "type": {
                        "type": "string",
                        "enum": [
                            "algorithm",
                            "architecture",
                            "loss_function",
                            "optimization",
                            "regularization",
                            "math_formula",
                            "training_technique",
                            "inference_technique",
                            "data_augmentation",
                            "other",
                        ],
                        "description": "Type of technique",
                    },
                    "description": {
                        "type": "string",
                        "description": "How it works or is applied in the paper",
                    },
                    "formula": {
                        "type": "string",
                        "description": "Key mathematical formula in LaTeX if applicable (e.g., 'L = -\\sum y \\log(p)')",
                    },
                    "is_novel": {
                        "type": "boolean",
                        "description": "Whether this is introduced as novel in this paper",
                    },
                    "improves_upon": {
                        "type": "string",
                        "description": "What existing technique this improves upon, if any",
                    },
                },
                "required": ["name", "type", "description"],
            },
        },
        "keywords": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Key topics and concepts",
        },
        "confidence_overall": {
            "type": "number",
            "description": "Overall confidence in the analysis (0-1)",
        },
    },
    "required": ["summary", "claims", "methods", "techniques", "keywords", "confidence_overall"],
}


# Claim Extraction Schema
ClaimExtractionSchema: dict[str, Any] = {
    "type": "object",
    "properties": {
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "statement": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": [
                            "performance",
                            "methodology",
                            "theoretical",
                            "empirical",
                            "limitation",
                            "comparison",
                        ],
                    },
                    "confidence": {"type": "number"},
                    "evidence": {"type": "string"},
                    "context": {"type": "string"},
                    "quantitative": {"type": "boolean"},
                    "metrics": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "value": {"type": "string"},
                                "comparison": {"type": "string"},
                            },
                        },
                    },
                },
                "required": ["statement", "category", "confidence"],
            },
        },
    },
    "required": ["claims"],
}


# Contradiction Analysis Schema
ContradictionAnalysisSchema: dict[str, Any] = {
    "type": "object",
    "properties": {
        "contradictions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim1_index": {"type": "integer"},
                    "claim2_index": {"type": "integer"},
                    "contradiction_type": {
                        "type": "string",
                        "enum": ["direct", "methodological", "empirical", "interpretive"],
                    },
                    "strength": {
                        "type": "number",
                        "description": "Strength of contradiction (0-1)",
                    },
                    "explanation": {"type": "string"},
                    "possible_reconciliation": {"type": "string"},
                },
                "required": [
                    "claim1_index",
                    "claim2_index",
                    "contradiction_type",
                    "strength",
                    "explanation",
                ],
            },
        },
        "analysis_confidence": {"type": "number"},
    },
    "required": ["contradictions", "analysis_confidence"],
}


# Trend Analysis Schema
TrendAnalysisSchema: dict[str, Any] = {
    "type": "object",
    "properties": {
        "trends": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "direction": {
                        "type": "string",
                        "enum": ["rising", "stable", "declining"],
                    },
                    "velocity": {
                        "type": "number",
                        "description": "Rate of growth (0-10 scale)",
                    },
                    "evidence": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "related_methods": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "confidence": {"type": "number"},
                },
                "required": ["name", "description", "direction", "velocity", "confidence"],
            },
        },
        "meta_observations": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Higher-level observations about the research landscape",
        },
    },
    "required": ["trends"],
}


# Prediction Schema
PredictionSchema: dict[str, Any] = {
    "type": "object",
    "properties": {
        "predictions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "statement": {
                        "type": "string",
                        "description": "A specific, falsifiable prediction",
                    },
                    "category": {
                        "type": "string",
                        "enum": [
                            "method_adoption",
                            "performance_improvement",
                            "new_capability",
                            "trend_continuation",
                            "paradigm_shift",
                        ],
                    },
                    "confidence": {"type": "number"},
                    "timeframe": {
                        "type": "string",
                        "enum": ["1_month", "3_months", "6_months", "1_year"],
                    },
                    "reasoning": {"type": "string"},
                    "verification_criteria": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "How to verify if prediction came true",
                    },
                },
                "required": [
                    "statement",
                    "category",
                    "confidence",
                    "timeframe",
                    "reasoning",
                ],
            },
        },
    },
    "required": ["predictions"],
}


# Weekly Synthesis Schema
SynthesisSchema: dict[str, Any] = {
    "type": "object",
    "properties": {
        "executive_summary": {
            "type": "string",
            "description": "2-3 paragraph executive summary of the week",
        },
        "key_developments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "significance": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                    },
                    "related_papers": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["title", "description", "significance"],
            },
        },
        "emerging_themes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "theme": {"type": "string"},
                    "evidence": {"type": "string"},
                    "implications": {"type": "string"},
                },
                "required": ["theme", "evidence"],
            },
        },
        "notable_contradictions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "positions": {"type": "array", "items": {"type": "string"}},
                    "analysis": {"type": "string"},
                },
                "required": ["topic", "positions", "analysis"],
            },
        },
        "outlook": {
            "type": "string",
            "description": "Forward-looking analysis for the coming weeks",
        },
    },
    "required": ["executive_summary", "key_developments", "emerging_themes", "outlook"],
}


# Self-Correction Schema
SelfCorrectionSchema: dict[str, Any] = {
    "type": "object",
    "properties": {
        "error_analysis": {
            "type": "object",
            "properties": {
                "error_type": {
                    "type": "string",
                    "enum": [
                        "api_error",
                        "parsing_error",
                        "logic_error",
                        "data_quality",
                        "timeout",
                        "unknown",
                    ],
                },
                "root_cause": {"type": "string"},
                "severity": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
            },
            "required": ["error_type", "root_cause", "severity"],
        },
        "correction_strategy": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["retry", "skip", "modify_input", "escalate", "abort"],
                },
                "modifications": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "reasoning": {"type": "string"},
            },
            "required": ["action", "reasoning"],
        },
        "prevention": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Steps to prevent similar errors in the future",
        },
    },
    "required": ["error_analysis", "correction_strategy"],
}
