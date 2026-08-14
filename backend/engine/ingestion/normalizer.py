import re

def normalize_text(text: str) -> str:
    text = (text.replace("\u201c", '"').replace("\u201d", '"')
            .replace("\u2018", "'").replace("\u2019", "'")
            .replace("\u2014", "—").replace("\u2013", "-")
            .replace("\ufb01", "fi").replace("\ufb02", "fl")
            .replace("\u00a0", " "))
    text = re.sub(r"(?im)^(prompt\s*\d*|applicant\s*name|word\s*count)\s*:\s*.*$", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()

def validate_word_count(text: str) -> dict:
    count = len(re.findall(r"\b\w+[’'\w-]*\b", text))
    if count < 50: return {"valid": False, "word_count": count, "code": "TOO_SHORT"}
    if count > 3000: return {"valid": False, "word_count": count, "code": "TOO_LONG"}
    return {"valid": True, "word_count": count, "warning": "LOW_SAMPLE_CONFIDENCE" if count <= 150 else None}