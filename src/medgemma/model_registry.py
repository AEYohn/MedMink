"""MedGemma Model Registry for HAI-DEF models.

Provides dynamic model loading and hot-swapping for different MedGemma variants:
- MedGemma 1.5 4B (text, default)
- MedGemma 27B (text, high accuracy)
- MedGemma 27B Multimodal (vision + text)
- MedSigLIP (medical image encoder)
- MedASR (medical speech recognition)
"""

import asyncio
from dataclasses import dataclass
try:
    from enum import StrEnum
except ImportError:
    import enum
    class StrEnum(str, enum.Enum):
        pass
from typing import Any

import structlog

logger = structlog.get_logger()


class ModelType(StrEnum):
    """Available MedGemma model types."""
    TEXT_4B = "text_4b"           # google/medgemma-1.5-4b-it
    TEXT_27B = "text_27b"         # google/medgemma-27b-it
    MULTIMODAL_27B = "mm_27b"     # google/medgemma-27b-mm (hypothetical)
    SIGLIP = "siglip"             # MedSigLIP image encoder
    ASR = "asr"                   # MedASR speech recognition


@dataclass
class ModelConfig:
    """Configuration for a MedGemma model variant."""
    model_id: str
    model_type: ModelType
    description: str
    min_vram_gb: float
    supports_images: bool = False
    supports_audio: bool = False
    accuracy_tier: str = "standard"  # standard, high, specialized


# Model registry with configurations
MODEL_CONFIGS = {
    ModelType.TEXT_4B: ModelConfig(
        model_id="google/medgemma-1.5-4b-it",
        model_type=ModelType.TEXT_4B,
        description="Fast 4B text model for clinical reasoning",
        min_vram_gb=10.0,
        accuracy_tier="standard",
    ),
    ModelType.TEXT_27B: ModelConfig(
        model_id="google/medgemma-27b-it",
        model_type=ModelType.TEXT_27B,
        description="High-accuracy 27B text model (87.7% MedQA)",
        min_vram_gb=32.0,
        accuracy_tier="high",
    ),
    ModelType.MULTIMODAL_27B: ModelConfig(
        model_id="google/medgemma-27b-multimodal",
        model_type=ModelType.MULTIMODAL_27B,
        description="27B model with medical imaging support",
        min_vram_gb=40.0,
        supports_images=True,
        accuracy_tier="high",
    ),
    ModelType.SIGLIP: ModelConfig(
        model_id="google/medsiglip",
        model_type=ModelType.SIGLIP,
        description="Medical image encoder for X-ray/CT/pathology",
        min_vram_gb=2.0,
        supports_images=True,
        accuracy_tier="specialized",
    ),
    ModelType.ASR: ModelConfig(
        model_id="google/medasr",
        model_type=ModelType.ASR,
        description="Medical speech recognition for clinical notes",
        min_vram_gb=4.0,
        supports_audio=True,
        accuracy_tier="specialized",
    ),
}


class ModelRegistry:
    """Registry for managing multiple MedGemma model variants.

    Supports:
    - Dynamic model loading based on task requirements
    - Hot-swapping between models
    - Automatic fallback when preferred model unavailable
    - VRAM-aware model selection
    """

    def __init__(self):
        self._loaded_models: dict[ModelType, Any] = {}
        self._tokenizers: dict[ModelType, Any] = {}
        self._available_vram: float | None = None
        self._current_model: ModelType | None = None

    def get_available_vram(self) -> float:
        """Detect available GPU VRAM in GB."""
        if self._available_vram is not None:
            return self._available_vram

        try:
            import torch

            if torch.cuda.is_available():
                # NVIDIA GPU
                total = torch.cuda.get_device_properties(0).total_memory
                self._available_vram = total / (1024**3)
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                # Apple Silicon - estimate from system memory
                import platform
                if platform.machine() == "arm64":
                    # Conservative estimate: use 50% of unified memory
                    import subprocess
                    result = subprocess.run(
                        ["sysctl", "-n", "hw.memsize"],
                        capture_output=True, text=True
                    )
                    total_ram = int(result.stdout.strip()) / (1024**3)
                    self._available_vram = total_ram * 0.5
                else:
                    self._available_vram = 8.0  # Conservative default
            else:
                self._available_vram = 0.0  # CPU only

            logger.info("Detected available VRAM", vram_gb=self._available_vram)

        except Exception as e:
            logger.warning("Failed to detect VRAM", error=str(e))
            self._available_vram = 8.0  # Conservative default

        return self._available_vram

    def get_recommended_model(
        self,
        task: str = "text",
        require_accuracy: str = "standard",
    ) -> ModelType:
        """Get recommended model for a task based on available resources.

        Args:
            task: "text", "image", "audio", or "multimodal"
            require_accuracy: "standard" or "high"

        Returns:
            Recommended ModelType
        """
        vram = self.get_available_vram()

        # Audio tasks
        if task == "audio":
            config = MODEL_CONFIGS[ModelType.ASR]
            if vram >= config.min_vram_gb:
                return ModelType.ASR
            logger.warning("Insufficient VRAM for MedASR")
            return ModelType.TEXT_4B  # Fallback: transcribe externally

        # Image tasks
        if task in ("image", "multimodal"):
            # Try multimodal 27B first if high accuracy needed
            if require_accuracy == "high" and vram >= MODEL_CONFIGS[ModelType.MULTIMODAL_27B].min_vram_gb:
                return ModelType.MULTIMODAL_27B
            # Try SigLIP for encoding + 4B for reasoning
            if vram >= MODEL_CONFIGS[ModelType.SIGLIP].min_vram_gb + MODEL_CONFIGS[ModelType.TEXT_4B].min_vram_gb:
                return ModelType.SIGLIP  # Will be combined with text model
            logger.warning("Insufficient VRAM for vision models")
            return ModelType.TEXT_4B  # Fallback: text-only analysis

        # Text tasks
        if require_accuracy == "high" and vram >= MODEL_CONFIGS[ModelType.TEXT_27B].min_vram_gb:
            return ModelType.TEXT_27B

        return ModelType.TEXT_4B

    async def load_model(self, model_type: ModelType) -> bool:
        """Load a model into memory.

        Args:
            model_type: Which model variant to load

        Returns:
            True if loaded successfully
        """
        if model_type in self._loaded_models:
            logger.info("Model already loaded", model=model_type.value)
            return True

        config = MODEL_CONFIGS[model_type]
        vram = self.get_available_vram()

        if vram < config.min_vram_gb:
            logger.error(
                "Insufficient VRAM for model",
                model=model_type.value,
                required=config.min_vram_gb,
                available=vram,
            )
            return False

        try:
            # Load in thread pool to avoid blocking
            result = await asyncio.to_thread(
                self._load_model_sync,
                model_type,
                config,
            )
            return result

        except Exception as e:
            logger.error("Failed to load model", model=model_type.value, error=str(e))
            return False

    def _load_model_sync(self, model_type: ModelType, config: ModelConfig) -> bool:
        """Synchronous model loading."""
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        logger.info("Loading model", model=config.model_id)

        # Determine device
        if torch.cuda.is_available():
            device_map = "auto"
            dtype = torch.bfloat16
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device_map = "mps"
            dtype = torch.float32  # MPS requires float32 for Gemma
        else:
            device_map = "cpu"
            dtype = torch.float32

        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            config.model_id,
            trust_remote_code=True,
        )

        # Load model based on type
        if model_type in (ModelType.TEXT_4B, ModelType.TEXT_27B, ModelType.MULTIMODAL_27B):
            model = AutoModelForCausalLM.from_pretrained(
                config.model_id,
                trust_remote_code=True,
                device_map=device_map,
                torch_dtype=dtype,
                low_cpu_mem_usage=True,
            )
        elif model_type == ModelType.SIGLIP:
            from transformers import AutoModel
            model = AutoModel.from_pretrained(
                config.model_id,
                trust_remote_code=True,
                device_map=device_map,
                torch_dtype=dtype,
            )
        elif model_type == ModelType.ASR:
            # ASR uses Whisper-like architecture
            from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor
            model = AutoModelForSpeechSeq2Seq.from_pretrained(
                config.model_id,
                trust_remote_code=True,
                device_map=device_map,
                torch_dtype=dtype,
            )
            # ASR uses processor instead of tokenizer
            tokenizer = AutoProcessor.from_pretrained(config.model_id)
        else:
            raise ValueError(f"Unknown model type: {model_type}")

        self._loaded_models[model_type] = model
        self._tokenizers[model_type] = tokenizer
        self._current_model = model_type

        logger.info("Model loaded successfully", model=config.model_id)
        return True

    def unload_model(self, model_type: ModelType) -> bool:
        """Unload a model to free memory.

        Args:
            model_type: Which model to unload

        Returns:
            True if unloaded successfully
        """
        if model_type not in self._loaded_models:
            return False

        try:
            import gc

            import torch

            # Delete model and tokenizer
            del self._loaded_models[model_type]
            del self._tokenizers[model_type]

            # Clear caches
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            if self._current_model == model_type:
                self._current_model = None

            logger.info("Model unloaded", model=model_type.value)
            return True

        except Exception as e:
            logger.error("Failed to unload model", model=model_type.value, error=str(e))
            return False

    def get_model(self, model_type: ModelType) -> tuple[Any, Any] | None:
        """Get a loaded model and tokenizer.

        Args:
            model_type: Which model to get

        Returns:
            Tuple of (model, tokenizer) or None if not loaded
        """
        if model_type not in self._loaded_models:
            return None
        return self._loaded_models[model_type], self._tokenizers[model_type]

    def list_loaded_models(self) -> list[ModelType]:
        """List all currently loaded models."""
        return list(self._loaded_models.keys())

    def get_model_info(self, model_type: ModelType) -> dict[str, Any]:
        """Get information about a model.

        Args:
            model_type: Which model to query

        Returns:
            Model information dictionary
        """
        config = MODEL_CONFIGS[model_type]
        vram = self.get_available_vram()

        return {
            "model_id": config.model_id,
            "type": model_type.value,
            "description": config.description,
            "min_vram_gb": config.min_vram_gb,
            "supports_images": config.supports_images,
            "supports_audio": config.supports_audio,
            "accuracy_tier": config.accuracy_tier,
            "can_load": vram >= config.min_vram_gb,
            "is_loaded": model_type in self._loaded_models,
        }

    def list_all_models(self) -> list[dict[str, Any]]:
        """List all available models with their info."""
        return [self.get_model_info(mt) for mt in ModelType]


# Singleton instance
_registry: ModelRegistry | None = None


def get_model_registry() -> ModelRegistry:
    """Get or create model registry singleton."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry
