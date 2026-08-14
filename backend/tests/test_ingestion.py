import io
from docx import Document
from engine.ingestion.file_parsers import extract_text
from engine.ingestion.normalizer import normalize_text, validate_word_count

ESSAY = "This is a deliberately longer sample sentence written for parser testing. " * 12

def test_normalization_headers_quotes_ligatures():
    normalized = normalize_text('Prompt 1: ignore this\n“Smart” ﬁeld — ready')
    assert "Prompt 1" not in normalized and '"Smart"' in normalized and "field" in normalized and "—" in normalized

def test_word_count_branches():
    assert validate_word_count("one two")['code'] == 'TOO_SHORT'
    assert validate_word_count(ESSAY)['warning'] == 'LOW_SAMPLE_CONFIDENCE'
    assert validate_word_count("word " * 3001)['code'] == 'TOO_LONG'

def test_docx_extraction():
    stream = io.BytesIO(); doc = Document(); doc.add_paragraph(ESSAY); doc.save(stream)
    text, result = extract_text('essay.docx', stream.getvalue())
    assert "parser testing" in text and result['valid']