"""Pytest configuration and fixtures."""

import asyncio
import os
from datetime import datetime, timedelta
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

# Set test environment
os.environ["ENVIRONMENT"] = "test"
os.environ["GEMINI_API_KEY"] = "test-key"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_task_queue():
    """Create a mock task queue."""
    queue = MagicMock()
    queue.add = AsyncMock()
    queue.get_stats = AsyncMock(return_value={
        "pending": 5,
        "in_progress": 2,
        "completed": 100,
        "failed": 3,
    })
    return queue


@pytest.fixture
def mock_gemini_client():
    """Create a mock Gemini client."""
    client = MagicMock()

    # Mock analyze_paper
    client.analyze_paper = AsyncMock(return_value={
        "summary": "Test paper summary",
        "claims": [
            {
                "statement": "Test claim 1",
                "category": "performance",
                "confidence": 0.8,
                "evidence": "Test evidence",
            },
            {
                "statement": "Test claim 2",
                "category": "methodology",
                "confidence": 0.7,
            },
        ],
        "methods": [
            {
                "name": "Test Method",
                "description": "A test method",
                "is_novel": True,
            },
        ],
        "keywords": ["test", "machine learning"],
        "confidence_overall": 0.85,
    })

    # Mock detect_contradictions
    client.detect_contradictions = AsyncMock(return_value={
        "contradictions": [],
        "analysis_confidence": 0.9,
    })

    # Mock identify_trends
    client.identify_trends = AsyncMock(return_value={
        "trends": [
            {
                "name": "Test Trend",
                "description": "A test trend",
                "direction": "rising",
                "velocity": 7.5,
                "confidence": 0.8,
            },
        ],
        "meta_observations": ["Test observation"],
    })

    # Mock generate_predictions
    client.generate_predictions = AsyncMock(return_value={
        "predictions": [
            {
                "statement": "Test prediction",
                "category": "method_adoption",
                "confidence": 0.6,
                "timeframe": "3_months",
                "reasoning": "Test reasoning",
            },
        ],
    })

    # Mock synthesize_weekly
    client.synthesize_weekly = AsyncMock(return_value={
        "executive_summary": "Test executive summary",
        "key_developments": [
            {
                "title": "Test Development",
                "description": "A test development",
                "significance": "high",
            },
        ],
        "emerging_themes": [
            {
                "theme": "Test Theme",
                "evidence": "Test evidence",
            },
        ],
        "notable_contradictions": [],
        "outlook": "Test outlook",
    })

    # Mock analyze_error
    client.analyze_error = AsyncMock(return_value={
        "error_analysis": {
            "error_type": "api_error",
            "root_cause": "Test root cause",
            "severity": "low",
        },
        "correction_strategy": {
            "action": "retry",
            "modifications": [],
            "reasoning": "Test reasoning",
        },
        "prevention": ["Test prevention step"],
    })

    # Mock get_stats
    client.get_stats = MagicMock(return_value={
        "rate_limiter": {
            "requests_used": 10,
            "requests_limit": 60,
            "tokens_used": 50000,
            "tokens_limit": 1000000,
        },
        "cost_tracker": {
            "daily_cost": 0.5,
            "daily_budget": 10.0,
            "monthly_cost": 5.0,
            "monthly_budget": 200.0,
        },
        "model": "gemini-2.0-flash",
    })

    return client


@pytest.fixture
def mock_knowledge_graph():
    """Create a mock knowledge graph."""
    kg = MagicMock()

    # Mock setup_schema
    kg.setup_schema = AsyncMock()

    # Mock paper operations
    kg.add_paper = AsyncMock()
    kg.get_paper = AsyncMock(return_value=None)
    kg.get_paper_by_arxiv_id = AsyncMock(return_value=None)
    kg.get_unanalyzed_papers = AsyncMock(return_value=[])
    kg.mark_paper_analyzed = AsyncMock()

    # Mock claim operations
    kg.add_claim = AsyncMock()
    kg.get_claims_for_paper = AsyncMock(return_value=[])
    kg.get_all_claims = AsyncMock(return_value=[])
    kg.update_claim_status = AsyncMock()

    # Mock contradiction operations
    kg.add_contradiction = AsyncMock()
    kg.get_contradictions = AsyncMock(return_value=[])
    kg.get_potential_contradictions = AsyncMock(return_value=[])

    # Mock method operations
    kg.add_method = AsyncMock()
    kg.get_popular_methods = AsyncMock(return_value=[])

    # Mock trend operations
    kg.add_trend = AsyncMock()
    kg.get_trends = AsyncMock(return_value=[])
    kg.get_rising_trends = AsyncMock(return_value=[])

    # Mock prediction operations
    kg.add_prediction = AsyncMock()
    kg.get_pending_predictions = AsyncMock(return_value=[])
    kg.get_due_predictions = AsyncMock(return_value=[])
    kg.update_prediction_outcome = AsyncMock()
    kg.get_prediction_accuracy = AsyncMock(return_value={
        "total": 10,
        "correct": 7,
        "incorrect": 2,
        "partial": 1,
        "accuracy": 0.7,
        "brier_score": 0.3,
        "avg_confidence": 0.65,
    })

    # Mock stats
    kg.get_stats = AsyncMock(return_value={
        "papers": 100,
        "claims": 500,
        "methods": 50,
        "trends": 10,
        "predictions": 20,
        "contradictions": 5,
    })

    kg.get_weekly_stats = AsyncMock(return_value={
        "new_papers": 25,
        "new_claims": 100,
        "new_contradictions": 2,
        "new_predictions": 5,
    })

    # Project operations
    kg.add_project = AsyncMock()
    kg.get_project = AsyncMock(return_value=None)
    kg.get_projects = AsyncMock(return_value=[])
    kg.update_project_status = AsyncMock()

    # Problem operations
    kg.add_problem = AsyncMock()
    kg.get_problems_for_project = AsyncMock(return_value=[])

    # Approach operations
    kg.add_approach = AsyncMock()
    kg.link_approach_to_method = AsyncMock()
    kg.link_approach_to_claim = AsyncMock()

    # Paper-problem linking
    kg.link_paper_to_problem = AsyncMock()

    # Project graph
    kg.get_project_graph = AsyncMock(return_value={"nodes": [], "edges": []})

    return kg


@pytest.fixture
def sample_paper():
    """Create a sample paper for testing."""
    from src.kg.models import PaperNode
    from datetime import datetime

    return PaperNode(
        id="test-paper-id",
        arxiv_id="2401.00001",
        title="Test Paper Title",
        abstract="This is a test abstract for the paper.",
        authors=["Author One", "Author Two"],
        categories=["cs.AI", "cs.LG"],
        published_date=datetime.utcnow(),
        analyzed=False,
    )


@pytest.fixture
def sample_claim():
    """Create a sample claim for testing."""
    from src.kg.models import ClaimNode

    return ClaimNode(
        id="test-claim-id",
        paper_id="test-paper-id",
        statement="Test claim statement",
        category="performance",
        confidence=0.8,
        status="unverified",
    )


@pytest.fixture
def sample_task():
    """Create a sample task for testing."""
    from src.models import Task, TaskType, TaskStatus

    return Task(
        id="test-task-id",
        type=TaskType.INGEST,
        status=TaskStatus.PENDING,
        priority=5,
        payload={"topic": "machine learning"},
    )


@pytest.fixture
def sample_project():
    """Create a sample project for testing."""
    from src.kg.models import ProjectNode
    from datetime import datetime

    return ProjectNode(
        id="test-project-id",
        name="Test Competition",
        url="https://kaggle.com/competitions/test-competition",
        source="kaggle",
        description="A test Kaggle competition",
        status="pending",
        created_at=datetime.utcnow(),
    )


@pytest.fixture
def sample_problem():
    """Create a sample problem for testing."""
    from src.kg.models import ProblemNode

    return ProblemNode(
        id="test-problem-id",
        project_id="test-project-id",
        statement="Predict the target variable accurately",
        category="objective",
        details="Binary classification problem with imbalanced classes",
        priority=5,
    )


@pytest.fixture
def sample_approach():
    """Create a sample approach for testing."""
    from src.kg.models import ApproachNode

    return ApproachNode(
        id="test-approach-id",
        project_id="test-project-id",
        name="Gradient Boosting Ensemble",
        description="Use XGBoost with careful feature engineering and cross-validation",
        priority=1,
        confidence=0.8,
        reasoning="Gradient boosting typically performs well on tabular data",
        challenges=["Feature selection", "Handling missing values"],
        mitigations=["Use feature importance", "Impute with median/mode"],
    )


@pytest.fixture
def sample_project_task():
    """Create a sample project analysis task for testing."""
    from src.models import Task, TaskType, TaskStatus

    return Task(
        id="test-project-task-id",
        type=TaskType.PROJECT_ANALYZE,
        status=TaskStatus.PENDING,
        priority=6,
        payload={
            "url": "https://kaggle.com/competitions/titanic",
            "name": "Titanic Survival Prediction",
        },
    )


# ============================================================================
# Healthcare-specific fixtures
# ============================================================================


@pytest.fixture
def mock_medgemma_client():
    """Create a mock MedGemma client for local inference tests."""
    client = MagicMock()
    client.is_available = True
    client.model_path = "models/medgemma-4b-it-Q4_K_M.gguf"

    # Mock generate method
    client.generate = AsyncMock(return_value=(
        "Based on the symptoms described, this appears to be consistent with "
        "an upper respiratory infection. Rest and fluids are recommended. "
        "If symptoms worsen, seek medical attention."
    ))

    # Mock extract_pico method
    client.extract_pico = AsyncMock(return_value={
        "condition": "type 2 diabetes",
        "intervention": "metformin",
        "population": "adults over 40",
        "outcome": "glycemic control"
    })

    # Mock evidence_synthesis method
    client.synthesize_evidence = AsyncMock(return_value={
        "synthesis": "Metformin is first-line therapy for type 2 diabetes with strong evidence.",
        "evidence_grade": "high",
        "key_findings": [
            {"finding": "Reduces HbA1c by 1-1.5%", "strength": "strong"},
            {"finding": "Weight neutral or slight loss", "strength": "moderate"},
        ],
        "contradictions": [],
        "confidence": 0.85
    })

    return client


@pytest.fixture
def mock_twilio_client():
    """Create a mock Twilio client for SMS/voice tests."""
    client = MagicMock()

    # Mock messages.create for SMS
    mock_message = MagicMock()
    mock_message.sid = "SM" + "a" * 32
    mock_message.status = "queued"
    mock_message.date_sent = None
    client.messages.create = MagicMock(return_value=mock_message)

    # Mock calls.create for voice
    mock_call = MagicMock()
    mock_call.sid = "CA" + "b" * 32
    mock_call.status = "queued"
    client.calls.create = MagicMock(return_value=mock_call)

    return client


@pytest.fixture
def mock_symptom_analyzer():
    """Create a mock symptom analyzer for patient endpoint tests."""
    analyzer = MagicMock()
    analyzer.analyze_symptoms = AsyncMock(return_value={
        "response": "I understand you're experiencing a headache. Here's my assessment.",
        "urgency": "routine",
        "possible_conditions": [
            {"name": "Tension headache", "probability": "high", "description": "Common headache type"},
            {"name": "Migraine", "probability": "moderate", "description": "May need medication"},
        ],
        "recommendations": [
            "Rest in a quiet, dark room",
            "Stay hydrated",
            "Consider over-the-counter pain relief",
        ],
        "seek_care": False,
        "care_timeframe": None,
        "follow_up_questions": [
            "How long have you had this headache?",
            "Have you taken any medications?",
        ],
        "confidence": 0.75
    })
    return analyzer


@pytest.fixture
def mock_medication_checker():
    """Create a mock medication interaction checker."""
    checker = MagicMock()
    checker.check_interactions = AsyncMock(return_value={
        "safe": False,
        "interactions": [
            {
                "drug1": "warfarin",
                "drug2": "aspirin",
                "severity": "major",
                "description": "Increased risk of bleeding when combined",
                "recommendation": "Monitor closely for signs of bleeding",
                "evidence_level": "established"
            }
        ],
        "recommendations": [
            "Consult your healthcare provider before combining these medications",
            "Monitor for signs of unusual bleeding",
        ],
        "confidence": 0.9
    })
    return checker


@pytest.fixture
def mock_scheduler_agent():
    """Create a mock scheduler agent for appointment tests."""
    agent = MagicMock()

    # Mock create_appointment
    agent.create_appointment = AsyncMock(return_value={
        "success": True,
        "appointment": {
            "id": "apt-12345",
            "patient_id": "patient-001",
            "patient_name": "John Doe",
            "patient_phone": "+1234567890",
            "patient_email": "john@example.com",
            "provider": "Dr. Smith",
            "datetime": (datetime.now() + timedelta(days=1)).isoformat(),
            "duration": 30,
            "type": "in-person",
            "status": "pending",
            "reason": "Annual checkup",
        },
        "message": "Appointment created successfully"
    })

    # Mock find_available_slots
    tomorrow = datetime.now() + timedelta(days=1)
    agent.find_available_slots = AsyncMock(return_value={
        "date": tomorrow.date().isoformat(),
        "provider": "Dr. Smith",
        "total_slots": 16,
        "available_slots": 10,
        "slots": [
            {
                "start_time": tomorrow.replace(hour=9, minute=0).isoformat(),
                "end_time": tomorrow.replace(hour=9, minute=30).isoformat(),
                "available": True
            },
            {
                "start_time": tomorrow.replace(hour=9, minute=30).isoformat(),
                "end_time": tomorrow.replace(hour=10, minute=0).isoformat(),
                "available": True
            },
            {
                "start_time": tomorrow.replace(hour=10, minute=0).isoformat(),
                "end_time": tomorrow.replace(hour=10, minute=30).isoformat(),
                "available": False
            },
        ]
    })

    # Mock optimize_schedule
    agent.optimize_schedule = AsyncMock(return_value={
        "date": tomorrow.date().isoformat(),
        "provider": "Dr. Smith",
        "utilization": 62.5,
        "total_appointments": 10,
        "scheduled_minutes": 300,
        "available_minutes": 180,
        "gaps": [
            {
                "start": tomorrow.replace(hour=14, minute=0).isoformat(),
                "end": tomorrow.replace(hour=15, minute=0).isoformat(),
                "duration_minutes": 60
            }
        ],
        "recommendations": [
            "Found 1 gap in the schedule that could be filled",
            "Consider marketing outreach for afternoon slots"
        ]
    })

    # Mock get_appointments
    agent.get_appointments = AsyncMock(return_value=[
        {
            "id": "apt-12345",
            "patient_name": "John Doe",
            "datetime": tomorrow.replace(hour=9, minute=0).isoformat(),
            "status": "confirmed"
        }
    ])

    # Mock cancel_appointment
    agent.cancel_appointment = AsyncMock(return_value={
        "success": True,
        "message": "Appointment cancelled"
    })

    return agent


@pytest.fixture
def mock_clinical_agent():
    """Create a mock medical literature agent."""
    agent = MagicMock()
    agent.ask_clinical_question = AsyncMock(return_value=MagicMock(
        question="What is the evidence for metformin in type 2 diabetes?",
        pico={
            "condition": "type 2 diabetes",
            "intervention": "metformin",
            "population": "adults",
            "outcome": "glycemic control"
        },
        synthesis="Metformin is recommended as first-line therapy for type 2 diabetes.",
        evidence_grade="high",
        key_findings=[
            {"finding": "Reduces HbA1c", "strength": "strong"},
        ],
        contradictions=[],
        recommendation="Use metformin as first-line therapy",
        recommendation_strength="strong",
        papers=[
            {"id": "pmid-123", "title": "Metformin Study", "source": "pubmed"}
        ],
        limitations=["Limited long-term data"],
        search_terms=["metformin", "type 2 diabetes"],
        confidence=0.85
    ))
    return agent


@pytest.fixture
def sample_patient_user():
    """Create a sample patient user for testing."""
    return {
        "email": "patient@example.com",
        "password": "securepassword123",
        "first_name": "Jane",
        "last_name": "Patient",
        "phone": "+1234567890",
        "role": "patient"
    }


@pytest.fixture
def sample_provider_user():
    """Create a sample provider user for testing."""
    return {
        "email": "doctor@example.com",
        "password": "providerpass456",
        "first_name": "Dr. John",
        "last_name": "Provider",
        "phone": "+0987654321",
        "role": "provider"
    }


@pytest.fixture
def sample_appointment_request():
    """Create a sample appointment request."""
    tomorrow = datetime.now() + timedelta(days=1)
    return {
        "patient_id": "patient-001",
        "patient_name": "John Doe",
        "patient_phone": "+1234567890",
        "patient_email": "john@example.com",
        "provider": "Dr. Smith",
        "datetime": tomorrow.replace(hour=10, minute=0, second=0, microsecond=0).isoformat(),
        "duration": 30,
        "type": "in-person",
        "reason": "Annual physical examination"
    }


@pytest.fixture
def sample_pubmed_papers():
    """Create sample PubMed paper responses."""
    return [
        {
            "id": "pmid-12345678",
            "title": "Efficacy of Metformin in Type 2 Diabetes: A Meta-Analysis",
            "abstract": "Background: Metformin is widely used as first-line therapy...",
            "authors": ["Smith J", "Jones A", "Brown K"],
            "published": "2024-01-15",
            "source": "pubmed",
            "url": "https://pubmed.ncbi.nlm.nih.gov/12345678/"
        },
        {
            "id": "pmid-87654321",
            "title": "Cardiovascular Benefits of Metformin",
            "abstract": "Objective: To evaluate cardiovascular outcomes...",
            "authors": ["Williams R", "Davis M"],
            "published": "2024-02-20",
            "source": "pubmed",
            "url": "https://pubmed.ncbi.nlm.nih.gov/87654321/"
        }
    ]
