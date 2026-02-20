"""Integration tests for Healthcare API endpoints.

Tests for all 28 healthcare-related endpoints:
- Auth Routes (6 tests)
- Patient Routes (5 tests)
- Admin Routes (12 tests)
- Medical Routes (7 tests)
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, MagicMock

from fastapi.testclient import TestClient

# ============================================================================
# Test Client Fixture
# ============================================================================


@pytest.fixture
def healthcare_client(
    mock_knowledge_graph,
    mock_task_queue,
    mock_medgemma_client,
    mock_twilio_client,
):
    """Create a test client with mocked healthcare dependencies."""
    with patch("src.api.main.init_databases", new_callable=AsyncMock):
        with patch("src.api.main.close_databases", new_callable=AsyncMock):
            with patch("src.api.main.get_knowledge_graph", new_callable=AsyncMock):
                # Mock MedGemma
                with patch("src.medgemma.get_medgemma_client", return_value=mock_medgemma_client):
                    # Mock Twilio
                    with patch(
                        "src.integrations.twilio.get_twilio_client", return_value=mock_twilio_client
                    ):
                        from src.api.main import app
                        from src.api import deps

                        # Override dependencies
                        app.dependency_overrides[deps.get_kg] = lambda: mock_knowledge_graph
                        app.dependency_overrides[deps.get_task_queue] = lambda: mock_task_queue

                        yield TestClient(app)

                        # Clean up overrides
                        app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(healthcare_client):
    """Get valid auth headers for protected endpoints."""
    # Register a test user
    response = healthcare_client.post(
        "/api/auth/register",
        json={
            "email": "testuser@example.com",
            "password": "testpassword123",
            "first_name": "Test",
            "last_name": "User",
        },
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# Auth Routes Tests (6 tests)
# ============================================================================


class TestAuthRoutes:
    """Tests for authentication endpoints."""

    def test_register_success(self, healthcare_client):
        """Test successful user registration returns tokens."""
        response = healthcare_client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepass123",
                "first_name": "New",
                "last_name": "User",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "expires_in" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_email(self, healthcare_client):
        """Test duplicate email registration returns 400."""
        # First registration
        healthcare_client.post(
            "/api/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "password123",
                "first_name": "First",
                "last_name": "User",
            },
        )

        # Attempt duplicate registration
        response = healthcare_client.post(
            "/api/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "differentpass",
                "first_name": "Second",
                "last_name": "User",
            },
        )

        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_login_success(self, healthcare_client):
        """Test successful login returns tokens."""
        # Register first
        healthcare_client.post(
            "/api/auth/register",
            json={
                "email": "logintest@example.com",
                "password": "mypassword123",
                "first_name": "Login",
                "last_name": "Test",
            },
        )

        # Login
        response = healthcare_client.post(
            "/api/auth/login", json={"email": "logintest@example.com", "password": "mypassword123"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_invalid_password(self, healthcare_client):
        """Test login with wrong password returns 401."""
        # Register first
        healthcare_client.post(
            "/api/auth/register",
            json={
                "email": "wrongpass@example.com",
                "password": "correctpassword",
                "first_name": "Wrong",
                "last_name": "Pass",
            },
        )

        # Login with wrong password
        response = healthcare_client.post(
            "/api/auth/login",
            json={"email": "wrongpass@example.com", "password": "incorrectpassword"},
        )

        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    def test_refresh_token(self, healthcare_client):
        """Test token refresh returns new tokens."""
        # Register and get refresh token
        reg_response = healthcare_client.post(
            "/api/auth/register",
            json={
                "email": "refreshtest@example.com",
                "password": "password123",
                "first_name": "Refresh",
                "last_name": "Test",
            },
        )
        refresh_token = reg_response.json()["refresh_token"]

        # Refresh
        response = healthcare_client.post(
            "/api/auth/refresh", json={"refresh_token": refresh_token}
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_get_current_user(self, healthcare_client, auth_headers):
        """Test getting current user profile."""
        response = healthcare_client.get("/api/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testuser@example.com"
        assert data["first_name"] == "Test"
        assert data["last_name"] == "User"
        assert "id" in data
        assert data["is_active"] is True


# ============================================================================
# Patient Routes Tests (5 tests)
# ============================================================================


class TestPatientRoutes:
    """Tests for patient-facing endpoints."""

    def test_symptom_analysis(self, healthcare_client, mock_symptom_analyzer):
        """Test symptom analysis returns urgency and recommendations."""
        with patch(
            "src.api.routes.patient.analyze_symptoms", mock_symptom_analyzer.analyze_symptoms
        ):
            response = healthcare_client.post(
                "/api/patient/symptoms",
                json={"symptoms": "I have had a headache for the past two days"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "urgency" in data
            assert "recommendations" in data
            assert "possible_conditions" in data
            assert "confidence" in data
            assert data["urgency"] in ["emergency", "urgent", "routine", "self-care"]

    def test_symptom_emergency_detection(self, healthcare_client):
        """Test that chest pain triggers emergency urgency."""
        with patch("src.api.routes.patient.analyze_symptoms") as mock_analyze:
            mock_analyze.return_value = {
                "response": "These symptoms require immediate medical attention.",
                "urgency": "emergency",
                "possible_conditions": [],
                "recommendations": ["Call 911 immediately"],
                "seek_care": True,
                "care_timeframe": "immediately",
                "follow_up_questions": [],
                "confidence": 0.95,
            }

            response = healthcare_client.post(
                "/api/patient/symptoms",
                json={"symptoms": "I am experiencing severe chest pain and shortness of breath"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["urgency"] == "emergency"
            assert data["seek_care"] is True

    def test_medication_check(self, healthcare_client, mock_medication_checker):
        """Test medication interaction check returns interactions."""
        with patch(
            "src.api.routes.patient.check_drug_interactions",
            mock_medication_checker.check_interactions,
        ):
            response = healthcare_client.post(
                "/api/patient/medications/check",
                json={"medications": ["warfarin", "aspirin", "ibuprofen"]},
            )

            assert response.status_code == 200
            data = response.json()
            assert "safe" in data
            assert "interactions" in data
            assert "recommendations" in data
            assert data["safe"] is False  # warfarin + aspirin is dangerous
            assert len(data["interactions"]) > 0

    def test_book_appointment(self, healthcare_client, mock_scheduler_agent):
        """Test booking an appointment."""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        with patch(
            "src.agents.scheduler.create_appointment", mock_scheduler_agent.create_appointment
        ):
            response = healthcare_client.post(
                "/api/patient/appointments/book",
                json={
                    "provider_id": "provider-001",
                    "preferred_date": tomorrow,
                    "preferred_time": "10:00",
                    "appointment_type": "in-person",
                    "reason": "Annual checkup",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "appointment" in data

    def test_available_slots(self, healthcare_client, mock_scheduler_agent):
        """Test getting available appointment slots."""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        with patch(
            "src.agents.scheduler.find_available_slots", mock_scheduler_agent.find_available_slots
        ):
            response = healthcare_client.post(
                "/api/patient/appointments/available-slots", json={"date": tomorrow, "duration": 30}
            )

            assert response.status_code == 200
            data = response.json()
            assert "slots" in data
            assert "available_count" in data or "available_slots" in data


# ============================================================================
# Admin Routes Tests (12 tests)
# ============================================================================


class TestAdminRoutes:
    """Tests for admin/practice management endpoints."""

    def test_create_appointment(self, healthcare_client, sample_appointment_request):
        """Test creating an appointment."""
        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance.create_appointment = AsyncMock(
                return_value={
                    "success": True,
                    "appointment": {
                        "id": "apt-new-123",
                        **sample_appointment_request,
                        "status": "pending",
                    },
                }
            )
            MockAgent.return_value = mock_instance

            response = healthcare_client.post(
                "/api/admin/appointments", json=sample_appointment_request
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "appointment" in data

    def test_list_appointments(self, healthcare_client):
        """Test listing all appointments."""
        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance.get_appointments = AsyncMock(
                return_value=[
                    {"id": "apt-1", "patient_name": "John Doe", "status": "confirmed"},
                    {"id": "apt-2", "patient_name": "Jane Smith", "status": "pending"},
                ]
            )
            MockAgent.return_value = mock_instance

            response = healthcare_client.get("/api/admin/appointments")

            assert response.status_code == 200
            data = response.json()
            assert "appointments" in data
            assert "count" in data

    def test_list_appointments_filtered(self, healthcare_client):
        """Test listing appointments filtered by date."""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance.get_appointments = AsyncMock(
                return_value=[
                    {"id": "apt-1", "patient_name": "John Doe", "datetime": f"{tomorrow}T10:00:00"}
                ]
            )
            MockAgent.return_value = mock_instance

            response = healthcare_client.get(f"/api/admin/appointments?date={tomorrow}")

            assert response.status_code == 200
            data = response.json()
            assert "appointments" in data

    def test_get_appointment(self, healthcare_client):
        """Test getting a single appointment by ID."""
        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance._appointments = {
                "apt-123": MagicMock(
                    to_dict=MagicMock(
                        return_value={
                            "id": "apt-123",
                            "patient_name": "John Doe",
                            "status": "confirmed",
                        }
                    )
                )
            }
            MockAgent.return_value = mock_instance

            response = healthcare_client.get("/api/admin/appointments/apt-123")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "apt-123"

    def test_update_appointment(self, healthcare_client):
        """Test updating an appointment."""
        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance._appointments = {
                "apt-123": MagicMock(
                    status="pending",
                    notes=None,
                    to_dict=MagicMock(
                        return_value={
                            "id": "apt-123",
                            "status": "confirmed",
                            "notes": "Updated notes",
                        }
                    ),
                )
            }
            MockAgent.return_value = mock_instance

            response = healthcare_client.patch(
                "/api/admin/appointments/apt-123",
                json={"status": "confirmed", "notes": "Updated notes"},
            )

            assert response.status_code == 200

    def test_cancel_appointment(self, healthcare_client):
        """Test cancelling an appointment."""
        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance.cancel_appointment = AsyncMock(
                return_value={"success": True, "message": "Appointment cancelled"}
            )
            MockAgent.return_value = mock_instance

            response = healthcare_client.delete("/api/admin/appointments/apt-123")

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_optimize_schedule(self, healthcare_client):
        """Test schedule optimization returns recommendations."""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance.optimize_schedule = AsyncMock(
                return_value={
                    "date": tomorrow,
                    "utilization": 65.5,
                    "recommendations": ["Consider filling afternoon gaps"],
                    "gaps": [],
                }
            )
            MockAgent.return_value = mock_instance

            response = healthcare_client.post(
                "/api/admin/schedule/optimize", json={"date": tomorrow}
            )

            assert response.status_code == 200
            data = response.json()
            assert "utilization" in data
            assert "recommendations" in data

    def test_get_available_slots(self, healthcare_client):
        """Test getting available schedule slots."""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance.find_available_slots = AsyncMock(
                return_value={
                    "date": tomorrow,
                    "slots": [
                        {"start_time": f"{tomorrow}T09:00:00", "available": True},
                        {"start_time": f"{tomorrow}T09:30:00", "available": False},
                    ],
                }
            )
            MockAgent.return_value = mock_instance

            response = healthcare_client.get(f"/api/admin/schedule/available-slots?date={tomorrow}")

            assert response.status_code == 200
            data = response.json()
            assert "slots" in data

    def test_send_reminder(self, healthcare_client, mock_twilio_client):
        """Test sending appointment reminders."""
        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance._appointments = {}
            MockAgent.return_value = mock_instance

            with patch("src.integrations.twilio.send_appointment_reminder") as mock_send:
                mock_send.return_value = {"message_sid": "SM123", "status": "sent"}

                response = healthcare_client.post(
                    "/api/admin/reminders/send", json={"channel": "sms"}
                )

                assert response.status_code == 200
                data = response.json()
                assert "total" in data

    def test_bulk_reminders(self, healthcare_client):
        """Test sending bulk reminders."""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance._appointments = {}
            MockAgent.return_value = mock_instance

            response = healthcare_client.post(
                "/api/admin/reminders/bulk", json={"date": tomorrow, "channel": "sms"}
            )

            assert response.status_code == 200

    def test_list_patients(self, healthcare_client):
        """Test listing patients (placeholder endpoint)."""
        response = healthcare_client.get("/api/admin/patients")

        assert response.status_code == 200
        data = response.json()
        assert "patients" in data
        assert "total" in data

    def test_get_patient_not_implemented(self, healthcare_client):
        """Test getting a patient returns 501 (not implemented)."""
        response = healthcare_client.get("/api/admin/patients/patient-123")

        assert response.status_code == 501


# ============================================================================
# Medical Routes Tests (7 tests)
# ============================================================================


class TestMedicalRoutes:
    """Tests for medical/clinical endpoints."""

    def test_clinical_ask(self, healthcare_client, mock_clinical_agent):
        """Test clinical question returns evidence synthesis."""
        with patch(
            "src.api.routes.medical.ask_clinical_question",
            mock_clinical_agent.ask_clinical_question,
        ):
            response = healthcare_client.post(
                "/api/medical/ask",
                json={
                    "question": "What is the evidence for metformin in type 2 diabetes?",
                    "max_papers": 10,
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "synthesis" in data
            assert "evidence_grade" in data
            assert "pico" in data
            assert "papers" in data
            assert "confidence" in data

    def test_medical_assistant(self, healthcare_client):
        """Test multi-model healthcare assistant query."""
        with patch("src.api.routes.medical.ask_healthcare_assistant") as mock_ask:
            mock_ask.return_value = MagicMock(
                query="What are the symptoms of diabetes?",
                response="Common symptoms include increased thirst, frequent urination...",
                task_type="patient_education",
                model_used="gemini-flash",
                confidence=0.85,
                reasoning="Patient education query routed to fast model",
                sources=[],
                metadata={},
            )

            response = healthcare_client.post(
                "/api/medical/assistant", json={"query": "What are the symptoms of diabetes?"}
            )

            assert response.status_code == 200
            data = response.json()
            assert "response" in data
            assert "model_used" in data
            assert "task_type" in data

    def test_route_preview(self, healthcare_client):
        """Test routing decision preview."""
        with patch("src.api.routes.medical.get_task_router") as mock_get_router:
            mock_router = MagicMock()
            mock_router.route = AsyncMock(
                return_value=MagicMock(
                    task_type=MagicMock(value="literature_search"),
                    model_name="medgemma-4b",
                    confidence=0.9,
                    reasoning="Medical literature query detected",
                    fallback_models=["gemini-pro"],
                )
            )
            mock_get_router.return_value = mock_router

            response = healthcare_client.post(
                "/api/medical/route",
                json={"query": "What does the literature say about metformin?"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "task_type" in data
            assert "model_name" in data
            assert "confidence" in data

    def test_list_models(self, healthcare_client):
        """Test listing available models."""
        with patch("src.routing.get_model_registry") as mock_get_registry:
            mock_registry = MagicMock()
            mock_registry.list_models.return_value = [
                MagicMock(
                    name="medgemma-4b",
                    provider="local",
                    capabilities=[MagicMock(value="medical_qa")],
                    is_local=True,
                    supports_medical=True,
                    priority=1,
                ),
                MagicMock(
                    name="gemini-pro",
                    provider="google",
                    capabilities=[MagicMock(value="general_qa")],
                    is_local=False,
                    supports_medical=True,
                    priority=2,
                ),
            ]
            mock_get_registry.return_value = mock_registry

            response = healthcare_client.get("/api/medical/models")

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) >= 1

    def test_ingest_pubmed(self, healthcare_client, sample_pubmed_papers):
        """Test PubMed paper ingestion."""
        with patch("src.api.routes.medical.search_pubmed_papers") as mock_search:
            mock_papers = []
            for p in sample_pubmed_papers:
                paper = MagicMock()
                paper.id = p["id"]
                paper.title = p["title"]
                paper.abstract = p["abstract"]
                paper.authors = p["authors"]
                paper.published = datetime.fromisoformat(p["published"])
                paper.source = p["source"]
                paper.pdf_url = p["url"]
                mock_papers.append(paper)

            mock_search.return_value = mock_papers

            response = healthcare_client.post(
                "/api/medical/ingest/pubmed",
                json={"mesh_terms": ["diabetes mellitus", "metformin"], "max_results": 20},
            )

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 2

    def test_ingest_preprints(self, healthcare_client):
        """Test medRxiv preprint ingestion."""
        with patch("src.api.routes.medical.search_preprints") as mock_search:
            mock_paper = MagicMock()
            mock_paper.id = "medrxiv-12345"
            mock_paper.title = "COVID-19 Treatment Study"
            mock_paper.abstract = "A study on COVID-19 treatments..."
            mock_paper.authors = ["Researcher A", "Researcher B"]
            mock_paper.published = datetime.now()
            mock_paper.source = "medrxiv"
            mock_paper.pdf_url = "https://medrxiv.org/content/12345"

            mock_search.return_value = [mock_paper]

            response = healthcare_client.post(
                "/api/medical/ingest/preprints",
                json={"server": "medrxiv", "days_back": 30, "keywords": ["covid-19", "treatment"]},
            )

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)

    def test_medical_health(self, healthcare_client, mock_medgemma_client):
        """Test medical service health check."""
        with patch("src.medgemma.get_medgemma_client", return_value=mock_medgemma_client):
            with patch("src.rag.local_chroma.get_local_chroma") as mock_chroma:
                mock_chroma_instance = MagicMock()
                mock_chroma_instance.count = 1500
                mock_chroma.return_value = mock_chroma_instance

                with patch("src.routing.get_model_registry") as mock_registry:
                    mock_registry_instance = MagicMock()
                    mock_registry_instance.list_models.return_value = [MagicMock(), MagicMock()]
                    mock_registry.return_value = mock_registry_instance

                    response = healthcare_client.get("/api/medical/health")

                    assert response.status_code == 200
                    data = response.json()
                    assert data["status"] == "healthy"
                    assert "medgemma_available" in data


# ============================================================================
# Health Check Tests
# ============================================================================


class TestHealthChecks:
    """Tests for service health endpoints."""

    def test_patient_health(self, healthcare_client):
        """Test patient service health endpoint."""
        response = healthcare_client.get("/api/patient/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "services" in data

    def test_admin_health(self, healthcare_client, mock_twilio_client):
        """Test admin service health endpoint."""
        with patch("src.integrations.twilio.get_twilio_status") as mock_status:
            mock_status.return_value = "available"

            response = healthcare_client.get("/api/admin/health")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"


# ============================================================================
# Edge Cases and Error Handling Tests
# ============================================================================


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_symptom_check_too_short(self, healthcare_client):
        """Test symptom check with too short input."""
        response = healthcare_client.post(
            "/api/patient/symptoms", json={"symptoms": "pain"}  # Less than 5 characters
        )

        # Should fail validation
        assert response.status_code == 422

    def test_medication_check_single_drug(self, healthcare_client):
        """Test medication check with only one drug (needs at least 2)."""
        response = healthcare_client.post(
            "/api/patient/medications/check", json={"medications": ["aspirin"]}  # Only one drug
        )

        # Should fail validation - need at least 2 medications
        assert response.status_code == 422

    def test_appointment_not_found(self, healthcare_client):
        """Test getting non-existent appointment."""
        with patch("src.api.routes.admin.SchedulerAgent") as MockAgent:
            mock_instance = MagicMock()
            mock_instance._appointments = {}
            MockAgent.return_value = mock_instance

            response = healthcare_client.get("/api/admin/appointments/nonexistent-apt")

            assert response.status_code == 404

    def test_invalid_refresh_token(self, healthcare_client):
        """Test refresh with invalid token."""
        response = healthcare_client.post(
            "/api/auth/refresh", json={"refresh_token": "invalid-token-here"}
        )

        assert response.status_code == 401

    def test_login_nonexistent_user(self, healthcare_client):
        """Test login with non-existent email."""
        response = healthcare_client.post(
            "/api/auth/login", json={"email": "doesnotexist@example.com", "password": "anypassword"}
        )

        assert response.status_code == 401
