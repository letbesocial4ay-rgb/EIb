from pathlib import Path
from .normalizer import normalize_text, validate_word_count

def extract_text(filename: str, content: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".txt":
        text = content.decode("utf-8", errors="replace")
    elif suffix == ".docx":
        from docx import Document
        import io
        doc = Document(io.BytesIO(content))
        text = "\n".join(p.text for p in doc.paragraphs)
    elif suffix == ".pdf":
        import io, pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    else:
        raise ValueError("Supported formats are .txt, .docx, and .pdf")
    normalized = normalize_text(text)
    result = validate_word_count(normalized)
    return normalized, result