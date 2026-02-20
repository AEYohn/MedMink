"""PDF download and text extraction for research papers."""

import asyncio
import re
from typing import TypedDict

import httpx
import structlog

from src.config import settings

logger = structlog.get_logger()


class PDFExtractionError(Exception):
    """Error during PDF extraction."""

    pass


class ExtractedSections(TypedDict, total=False):
    """Extracted sections from a paper."""

    methods: str
    algorithm: str
    model: str
    training: str
    implementation: str
    experiments: str
    results: str


class ExtractionResult(TypedDict):
    """Result of PDF text extraction."""

    full_text: str
    sections: ExtractedSections
    page_count: int
    char_count: int


# Common section headers in ML papers (case-insensitive)
SECTION_PATTERNS = [
    (
        r"(?i)(?:^|\n)\s*(?:\d+\.?\s*)?(method|methodology|approach|our method|proposed method)\s*(?:\n|$)",
        "methods",
    ),
    (r"(?i)(?:^|\n)\s*(?:\d+\.?\s*)?(algorithm|procedure|pseudocode)\s*(?:\n|$)", "algorithm"),
    (
        r"(?i)(?:^|\n)\s*(?:\d+\.?\s*)?(model|architecture|network architecture|model architecture)\s*(?:\n|$)",
        "model",
    ),
    (r"(?i)(?:^|\n)\s*(?:\d+\.?\s*)?(training|optimization|learning)\s*(?:\n|$)", "training"),
    (
        r"(?i)(?:^|\n)\s*(?:\d+\.?\s*)?(implementation|experimental setup|setup|implementation details)\s*(?:\n|$)",
        "implementation",
    ),
    (
        r"(?i)(?:^|\n)\s*(?:\d+\.?\s*)?(experiments?|experimental results|evaluation)\s*(?:\n|$)",
        "experiments",
    ),
    (r"(?i)(?:^|\n)\s*(?:\d+\.?\s*)?(results?|main results)\s*(?:\n|$)", "results"),
]


def extract_sections(text: str, max_section_chars: int = 4000) -> ExtractedSections:
    """Extract specific sections from paper text.

    Looks for common section headers in ML papers and extracts content
    following those headers.

    Args:
        text: Full paper text
        max_section_chars: Maximum characters to extract per section

    Returns:
        Dictionary of section name -> section content
    """
    sections: ExtractedSections = {}

    for pattern, name in SECTION_PATTERNS:
        match = re.search(pattern, text)
        if match:
            start = match.end()
            # Extract content until next section or max chars
            section_content = text[start : start + max_section_chars]

            # Try to find a clean cutoff at next section header
            next_section = re.search(
                r"(?i)(?:^|\n)\s*(?:\d+\.?\s*)?(?:introduction|related work|background|method|conclusion|references|acknowledgment|appendix)\s*(?:\n|$)",
                section_content[500:],
            )
            if next_section:
                section_content = section_content[: 500 + next_section.start()]

            sections[name] = section_content.strip()

    return sections


async def extract_paper_text(
    pdf_url: str,
    timeout: int | None = None,
    max_size_mb: int | None = None,
) -> ExtractionResult:
    """Download and extract text from an arXiv PDF.

    Args:
        pdf_url: URL to the PDF file (typically arXiv PDF URL)
        timeout: Download timeout in seconds (default from settings)
        max_size_mb: Maximum PDF size in MB (default from settings)

    Returns:
        ExtractionResult with full_text, sections, page_count, and char_count

    Raises:
        PDFExtractionError: If download or extraction fails
    """
    timeout = timeout or settings.pdf_extraction_timeout
    max_size_mb = max_size_mb or settings.max_pdf_size_mb
    max_size_bytes = max_size_mb * 1024 * 1024

    logger.debug("Downloading PDF", url=pdf_url, timeout=timeout)

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            # First, do a HEAD request to check size
            try:
                head_response = await client.head(pdf_url)
                content_length = head_response.headers.get("content-length")
                if content_length and int(content_length) > max_size_bytes:
                    raise PDFExtractionError(
                        f"PDF too large: {int(content_length) / 1024 / 1024:.1f}MB > {max_size_mb}MB limit"
                    )
            except httpx.HTTPError:
                pass  # HEAD not supported, proceed with GET

            # Download the PDF
            response = await client.get(pdf_url)
            response.raise_for_status()

            if len(response.content) > max_size_bytes:
                raise PDFExtractionError(
                    f"PDF too large: {len(response.content) / 1024 / 1024:.1f}MB > {max_size_mb}MB limit"
                )

            pdf_bytes = response.content

    except httpx.TimeoutException as e:
        raise PDFExtractionError(f"PDF download timed out after {timeout}s: {pdf_url}") from e
    except httpx.HTTPError as e:
        raise PDFExtractionError(f"Failed to download PDF: {e}") from e

    logger.debug("PDF downloaded", url=pdf_url, size_kb=len(pdf_bytes) / 1024)

    # Extract text using pymupdf (run in thread pool to not block async loop)
    try:
        full_text, page_count = await asyncio.to_thread(_extract_text_from_bytes, pdf_bytes)
    except Exception as e:
        raise PDFExtractionError(f"Failed to extract text from PDF: {e}") from e

    # Extract key sections
    sections = extract_sections(full_text)

    logger.info(
        "PDF text extracted",
        url=pdf_url,
        pages=page_count,
        chars=len(full_text),
        sections_found=list(sections.keys()),
    )

    return ExtractionResult(
        full_text=full_text,
        sections=sections,
        page_count=page_count,
        char_count=len(full_text),
    )


def _extract_text_from_bytes(pdf_bytes: bytes) -> tuple[str, int]:
    """Extract text from PDF bytes using pymupdf.

    This is a synchronous function meant to be run in a thread pool.

    Args:
        pdf_bytes: Raw PDF file bytes

    Returns:
        Tuple of (full_text, page_count)
    """
    import fitz  # pymupdf - imported here to allow graceful handling if not installed

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    full_text = ""
    for page in doc:
        page_text = page.get_text()
        full_text += page_text + "\n"

    page_count = len(doc)
    doc.close()

    # Clean up the text
    full_text = _clean_extracted_text(full_text)

    return full_text, page_count


def _clean_extracted_text(text: str) -> str:
    """Clean up extracted PDF text.

    - Removes excessive whitespace
    - Fixes common OCR/extraction artifacts
    - Joins hyphenated words at line breaks
    """
    # Join hyphenated words at line breaks
    text = re.sub(r"-\s*\n\s*", "", text)

    # Replace multiple newlines with double newline
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Replace multiple spaces with single space
    text = re.sub(r" {2,}", " ", text)

    # Remove page numbers (common patterns)
    text = re.sub(r"\n\s*\d+\s*\n", "\n", text)

    # Fix common ligature issues
    text = text.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff")

    return text.strip()


async def extract_paper_text_safe(
    pdf_url: str | None,
    timeout: int | None = None,
    max_size_mb: int | None = None,
) -> ExtractionResult | None:
    """Safe wrapper around extract_paper_text that returns None on failure.

    Use this when you want to attempt extraction but gracefully fall back
    if it fails.

    Args:
        pdf_url: URL to the PDF file, or None
        timeout: Download timeout in seconds
        max_size_mb: Maximum PDF size in MB

    Returns:
        ExtractionResult if successful, None if pdf_url is None or extraction fails
    """
    if not pdf_url:
        return None

    try:
        return await extract_paper_text(pdf_url, timeout, max_size_mb)
    except PDFExtractionError as e:
        logger.warning("PDF extraction failed", url=pdf_url, error=str(e))
        return None
    except Exception as e:
        logger.warning("Unexpected error during PDF extraction", url=pdf_url, error=str(e))
        return None
