"""PDF / DOCX -> plain text."""
from __future__ import annotations

import io
import re

MAX_BYTES = 10 * 1024 * 1024  # 10 MB per file


class UnsupportedFile(ValueError):
    pass


def normalize(text: str) -> str:
    text = re.sub(r"\(cid:\d+\)", "\n• ", text)  # unmapped PDF bullet glyphs
    text = text.replace(" ", " ").replace("•", "\n• ").replace("●", "\n• ")
    text = text.replace("–", "-").replace("—", "-").replace("’", "'")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return "\n".join(line.strip() for line in text.splitlines()).strip()


def _pdf(data: bytes) -> str:
    import pdfplumber

    parts = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages[:15]:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def _docx(data: bytes) -> str:
    import docx

    d = docx.Document(io.BytesIO(data))
    parts = [p.text for p in d.paragraphs]
    for t in d.tables:
        for row in t.rows:
            cells = []
            for c in row.cells:
                if c.text not in cells:
                    cells.append(c.text)
            parts.append(" | ".join(cells))
    return "\n".join(parts)


def extract_text(filename: str, data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise UnsupportedFile("File is larger than 10 MB")
    if not data:
        raise UnsupportedFile("File is empty")
    name = filename.lower()
    if name.endswith(".pdf") or data[:5] == b"%PDF-":
        text = _pdf(data)
    elif name.endswith(".docx") or data[:2] == b"PK":
        text = _docx(data)
    elif name.endswith(".txt"):
        text = data.decode("utf-8", errors="ignore")
    else:
        raise UnsupportedFile("Only PDF and DOCX files are supported")
    text = normalize(text)
    if len(text) < 40:
        raise UnsupportedFile("No readable text found (scanned image PDF? OCR is not enabled)")
    return text
