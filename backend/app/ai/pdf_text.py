"""Safe PDF text extraction. Every upload is treated as untrusted input."""

import re

import fitz  # PyMuPDF

MAX_PAGES = 20
MAX_CHARS = 60_000
MIN_CHARS = 100

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


class PdfError(Exception):
    """The message is safe to show to the user."""


def _clean(text: str) -> str:
    text = _CONTROL.sub("", text)
    return "\n".join(" ".join(line.split()) for line in text.splitlines()).strip()


def extract_pdf_text(data: bytes) -> tuple[str, int]:
    """Returns (text, page_count). Raises PdfError for anything unusable."""
    if not data.startswith(b"%PDF-"):
        raise PdfError("The file is not a valid PDF")
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise PdfError("The PDF could not be read. It may be corrupted.") from exc

    try:
        if doc.needs_pass:
            raise PdfError("Password-protected PDFs are not supported")
        pages = doc.page_count
        if pages == 0:
            raise PdfError("The PDF has no pages")
        if pages > MAX_PAGES:
            raise PdfError(f"The PDF has {pages} pages. The limit is {MAX_PAGES}.")
        chunks: list[str] = []
        total = 0
        for page in doc:
            part = page.get_text("text")
            chunks.append(part)
            total += len(part)
            if total >= MAX_CHARS:
                break
    except PdfError:
        raise
    except Exception as exc:
        raise PdfError("The PDF could not be read. It may be corrupted.") from exc
    finally:
        doc.close()

    text = _clean("\n".join(chunks))[:MAX_CHARS]
    if len(text) < MIN_CHARS:
        raise PdfError(
            "This PDF has little or no extractable text. It may be a scanned image, "
            "which needs OCR. OCR is not supported yet."
        )
    return text, pages
