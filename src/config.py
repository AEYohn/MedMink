"""Configuration management for the Research Synthesizer."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Environment
    environment: Literal["development", "staging", "production", "test"] = "development"
    log_level: str = "INFO"

    # API Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Gemini API
    gemini_api_key: str = Field(default="")
    gemini_model: str = "gemini-2.0-flash"
    gemini_requests_per_minute: int = 60
    gemini_tokens_per_minute: int = 1_000_000

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "research"
    postgres_password: str = "research_password"
    postgres_db: str = "research_synthesizer"

    @property
    def postgres_url(self) -> str:
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    @property
    def postgres_sync_url(self) -> str:
        return f"postgresql://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "neo4j_password"
    neo4j_database: str = "neo4j"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minio_access"
    minio_secret_key: str = "minio_secret"
    minio_bucket: str = "research-papers"
    minio_secure: bool = False

    # Budget Tracking
    daily_budget_usd: float = 10.0
    monthly_budget_usd: float = 200.0

    # Token Budget Controls (research-backed optimization)
    analysis_mode: Literal["quick", "standard", "deep"] = "standard"
    quick_analysis_max_tokens: int = 2048  # Fast scan, basic extraction
    standard_analysis_max_tokens: int = 8192  # Default balanced mode
    deep_analysis_max_tokens: int = 16384  # Full extraction with formulas/pseudocode

    # Analysis Caching
    enable_analysis_cache: bool = True
    cache_similarity_threshold: float = 0.85  # Reuse cache if >85% similar
    cache_ttl_hours: int = 168  # 7 days

    # Batch Analysis (reduces API calls)
    enable_batch_analysis: bool = True
    batch_size: int = 3  # Papers per API call
    max_batch_tokens: int = 32000  # Max tokens for batch prompt

    # PDF Extraction
    enable_full_text_extraction: bool = True
    pdf_extraction_timeout: int = 30  # seconds
    max_pdf_size_mb: int = 50

    # DSPy Analysis (declarative LM programming)
    use_dspy: bool = True  # Use DSPy modules instead of manual prompts
    dspy_deep_analysis: bool = True  # Enable deep analysis with multiple extraction passes
    dspy_optimized_model_path: str | None = None  # Path to load optimized DSPy modules

    # ArXiv
    arxiv_max_results: int = 100
    arxiv_categories: list[str] = Field(
        default=["cs.AI", "cs.LG", "cs.CL", "cs.CV", "stat.ML"]
    )

    # Orchestrator
    orchestrator_poll_interval: int = 5  # seconds
    orchestrator_max_concurrent_tasks: int = 3

    # Scheduling
    daily_ingest_hour: int = 6  # 6 AM UTC
    weekly_synthesis_day: int = 0  # Monday
    weekly_synthesis_hour: int = 8  # 8 AM UTC

    # Medical Literature Settings (MedLit Agent)
    medical_categories: list[str] = Field(
        default=["clinical-trial", "systematic-review", "meta-analysis", "rct"]
    )
    pubmed_api_key: str = ""  # NCBI API key for higher rate limits
    pubmed_email: str = ""  # Required for NCBI API
    default_mesh_terms: list[str] = Field(
        default=["therapeutics", "diagnosis", "prognosis", "treatment outcome"]
    )
    medical_specialties: list[str] = Field(
        default=["oncology", "cardiology", "neurology", "infectious diseases", "endocrinology"]
    )

    # MedGemma (Google HAI-DEF) - Required for MedGemma Impact Challenge
    medgemma_model: str = "./models/medgemma-1.5-4b-it"  # Local model path
    medgemma_device: str = "auto"  # auto, cuda, mps, cpu
    medgemma_load_in_4bit: bool = True  # Use 4-bit quantization for lower memory
    medgemma_context_length: int = 8192
    use_local_medgemma: bool = True  # Use local model vs cloud API (Vertex AI)

    # Modal (remote GPU inference for MedGemma 27B)
    medgemma_modal_url: str = ""  # e.g. https://USER--medgemma-27b-serve.modal.run
    medgemma_modal_model: str = "google/medgemma-27b-it"  # Model name served by vLLM

    # Modal (remote GPU inference for MedGemma Multimodal)
    medgemma_multimodal_modal_url: str = ""  # e.g. https://USER--medgemma-multimodal-serve.modal.run
    medgemma_multimodal_modal_model: str = "google/medgemma-27b-multimodal"

    # Modal (Whisper ASR for patient interview)
    whisper_modal_url: str = ""  # e.g. https://USER--whisper-asr-transcribe.modal.run

    # Modal (MedASR — Google Conformer for medical speech recognition)
    medasr_modal_url: str = ""  # e.g. https://USER--medasr-transcribe.modal.run
    medasr_model: str = "google/medasr"

    # Modal (CXR Foundation — Chest X-ray classifier)
    cxr_foundation_modal_url: str = ""  # e.g. https://USER--cxr-foundation-serve.modal.run

    # Modal (TxGemma — Drug property prediction)
    txgemma_modal_url: str = ""  # e.g. https://USER--txgemma-serve.modal.run
    txgemma_modal_model: str = "google/txgemma-9b-chat"

    # Modal (Derm Foundation — Skin lesion classifier)
    derm_foundation_modal_url: str = ""  # e.g. https://USER--derm-foundation-serve.modal.run

    # Modal (HeAR — Respiratory sound screening)
    hear_modal_url: str = ""  # e.g. https://USER--hear-serve.modal.run

    # Modal (Path Foundation — Digital pathology)
    path_foundation_modal_url: str = ""  # e.g. https://USER--path-foundation-serve.modal.run

    # Local ChromaDB
    chroma_persist_directory: str = "./data/chroma"
    chroma_collection_name: str = "medical_papers"
    medical_embedding_model: str = "pritamdeka/S-PubMedBert-MS-MARCO"

    # Authentication (Full Stack Healthcare Platform)
    jwt_secret_key: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Twilio (SMS & Voice AI)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    twilio_messaging_service_sid: str = ""


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Convenience alias
settings = get_settings()
