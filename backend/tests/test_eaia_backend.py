"""EAIA backend integration tests: auth, analyze, reports, health, SSE, validation."""
import os
import uuid
import json
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

# Sample essay ~140 words (>=50, <=3000)
SAMPLE_ESSAY = (
    "When I moved to a new city, I carried one small notebook and a question I could not answer. "
    "At first, every classroom felt like a locked door. I began volunteering at the neighborhood library, "
    "where a patient librarian showed me that curiosity is a practice rather than a personality trait. "
    "Over time, I learned to listen before offering solutions. That habit changed the way I worked with "
    "my robotics team and the way I understood my own mistakes. The experience taught me that meaningful "
    "growth rarely arrives as a dramatic moment. It emerges through small decisions, repeated attention, "
    "and the courage to revise an easy answer. Today, I still keep that notebook beside my desk, not as "
    "a record of certainty, but as an invitation to keep asking better questions."
)


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def account(api):
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    password = "TestPass1234!"
    r = api.post(f"{BASE_URL}/api/auth/signup", json={
        "email": email, "password": password, "name": "Test Reviewer"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    return {"email": email, "password": password, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def auth_headers(account):
    return {"Authorization": f"Bearer {account['token']}"}


class TestHealth:
    def test_health(self, api):
        r = api.get(f"{BASE_URL}/api/v1/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "healthy"
        assert "model_checkpoint" in data
        assert "inference_engine" in data


class TestAuth:
    def test_signup_and_login(self, api):
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        password = "SecurePass99"
        r = api.post(f"{BASE_URL}/api/auth/signup", json={
            "email": email, "password": password, "name": "T"
        })
        assert r.status_code == 200, r.text
        signup_token = r.json()["token"]
        assert isinstance(signup_token, str) and len(signup_token) > 20

        # login
        r2 = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert r2.status_code == 200
        assert "token" in r2.json()

        # /auth/me protected
        r3 = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {signup_token}"})
        assert r3.status_code == 200
        assert r3.json()["user"]["email"] == email

    def test_duplicate_signup_rejected(self, api, account):
        r = api.post(f"{BASE_URL}/api/auth/signup", json={
            "email": account["email"], "password": account["password"], "name": "Dup"
        })
        assert r.status_code == 409

    def test_invalid_login(self, api, account):
        r = api.post(f"{BASE_URL}/api/auth/login", json={
            "email": account["email"], "password": "wrongpassword"
        })
        assert r.status_code == 401

    def test_short_password_rejected(self, api):
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/signup", json={
            "email": email, "password": "short", "name": "S"
        })
        assert r.status_code == 422


class TestAnalyze:
    def test_analyze_requires_auth(self, api):
        r = api.post(f"{BASE_URL}/api/v1/analyze", json={"text": SAMPLE_ESSAY})
        assert r.status_code == 401

    def test_analyze_bad_token(self, api):
        r = api.post(f"{BASE_URL}/api/v1/analyze",
                     json={"text": SAMPLE_ESSAY},
                     headers={"Authorization": "Bearer notavalidtoken"})
        assert r.status_code == 401

    def test_analyze_success(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/v1/analyze",
                     json={"text": SAMPLE_ESSAY,
                           "options": {"include_token_details": True, "esl_sensitivity_dampener": True}},
                     headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "document_summary" in data and "sentences" in data
        ds = data["document_summary"]
        for k in ["overall_score", "verdict", "total_sentences", "composition", "engine"]:
            assert k in ds, f"missing {k}"
        assert isinstance(data["sentences"], list) and len(data["sentences"]) > 0
        sent = data["sentences"][0]
        for k in ["sentence_id", "text", "score", "classification", "perplexity",
                  "top10_ratio", "syntactic_depth", "reasons", "tokens"]:
            assert k in sent, f"sentence missing {k}"
        # tokens have rank bins
        assert sent["tokens"][0]["bin"] in ("green", "yellow", "red", "purple")

    def test_analyze_too_short(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/v1/analyze",
                     json={"text": "Only a few words."},
                     headers=auth_headers)
        assert r.status_code == 422

    def test_analyze_too_long(self, api, auth_headers):
        long_text = ("word " * 3100).strip()
        r = api.post(f"{BASE_URL}/api/v1/analyze",
                     json={"text": long_text},
                     headers=auth_headers)
        assert r.status_code == 413

    def test_analyze_esl_toggle_changes_scores(self, api, auth_headers):
        r_on = api.post(f"{BASE_URL}/api/v1/analyze",
                        json={"text": SAMPLE_ESSAY, "options": {"esl_sensitivity_dampener": True}},
                        headers=auth_headers)
        r_off = api.post(f"{BASE_URL}/api/v1/analyze",
                         json={"text": SAMPLE_ESSAY, "options": {"esl_sensitivity_dampener": False}},
                         headers=auth_headers)
        assert r_on.status_code == 200 and r_off.status_code == 200
        # raw_overall_score should be same, overall may differ (or equal if ESL~0)
        assert r_on.json()["document_summary"]["raw_overall_score"] == r_off.json()["document_summary"]["raw_overall_score"]


class TestStream:
    def test_stream_sse(self, api, account):
        # SSE endpoint uses query params
        url = f"{BASE_URL}/api/v1/analyze/stream"
        r = requests.get(url,
                         params={"text": SAMPLE_ESSAY, "esl": True},
                         headers={"Authorization": f"Bearer {account['token']}"},
                         stream=True, timeout=30)
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        # read a few chunks
        events = []
        for chunk in r.iter_lines(decode_unicode=True):
            if chunk:
                events.append(chunk)
            if len(events) >= 4:
                break
        r.close()
        text = "\n".join(events)
        assert "sentence_evaluated" in text or "analysis_complete" in text

    def test_stream_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/v1/analyze/stream", params={"text": SAMPLE_ESSAY})
        assert r.status_code == 401


class TestReports:
    def test_reports_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/v1/reports")
        assert r.status_code == 401

    def test_save_and_list_report_no_raw_essay(self, api, auth_headers):
        # analyze first
        r = api.post(f"{BASE_URL}/api/v1/analyze",
                     json={"text": SAMPLE_ESSAY},
                     headers=auth_headers)
        assert r.status_code == 200
        result = r.json()
        # frontend strips tokens and NOT raw essay text (it does send sentence.text)
        payload_sentences = [{k: v for k, v in s.items() if k != "tokens"} for s in result["sentences"]]
        save = api.post(f"{BASE_URL}/api/v1/reports",
                        json={"document_summary": result["document_summary"],
                              "sentences": payload_sentences,
                              "reviewer_notes": {"0": "test note"}},
                        headers=auth_headers)
        assert save.status_code == 200, save.text
        assert "id" in save.json()

        # list
        lst = api.get(f"{BASE_URL}/api/v1/reports", headers=auth_headers)
        assert lst.status_code == 200
        reports = lst.json()["reports"]
        assert len(reports) >= 1
        saved = reports[0]
        # Ensure the raw essay text is not stored as a whole document
        summary_blob = json.dumps(saved)
        # sentence-level text may be present per app design (privacy trade-off)
        # but the essay as one paste should not exist as a single string
        assert SAMPLE_ESSAY not in summary_blob, "Raw complete essay must not be persisted as single string"
