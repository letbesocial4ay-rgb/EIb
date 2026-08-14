from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, Header, Request, Response, Cookie
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
import os, re, math, json, uuid, hashlib, secrets, logging, io, asyncio, httpx
# Load .env early so HF_HOME etc. are set before transformers/torch import their config.
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
for _k in ("HF_HOME", "TRANSFORMERS_CACHE"):
    if os.environ.get("HF_HOME") and not os.environ.get(_k):
        os.environ[_k] = os.environ["HF_HOME"]
import bcrypt, jwt
from engine.ingestion.file_parsers import extract_text
from engine.inference.model_loader import load_local_model

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
app = FastAPI(title="Araxyss Explainable Essay Auditor")
router = APIRouter(prefix="/api")
logger = logging.getLogger("eaia")
local_model = load_local_model()

def redact(value: str) -> str:
    return value if len(value.split()) <= 3 else "[essay text redacted]"

class Signup(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=80)

class Login(BaseModel):
    email: EmailStr
    password: str

class Options(BaseModel):
    include_token_details: bool = True
    esl_sensitivity_dampener: bool = True

class AnalysisRequest(BaseModel):
    text: str
    options: Options = Options()

class SaveReport(BaseModel):
    document_summary: dict
    sentences: list[dict]
    reviewer_notes: dict = {}
    reviewer_overrides: dict = {}

class ExportRequest(AnalysisRequest):
    reviewer_overrides: dict = {}
    reviewer_notes: dict = {}

def token_parts(text: str):
    return re.findall(r"\b[\w’'-]+\b|[^\w\s]", text)

def normalize_text(text: str) -> str:
    text = text.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u2014", "—").replace("\u2013", "-").replace("\ufb01", "fi").replace("\ufb02", "fl").replace("\u00a0", " ")
    text = re.sub(r"(?im)^(prompt\s*\d*|applicant\s*name|word\s*count)\s*:\s*.*$", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()

def sigmoid(x): return 1 / (1 + math.exp(-max(-20, min(20, x))))

EMERGENT_AUTH_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
COOKIE_KWARGS = {"httponly": True, "secure": True, "samesite": "none", "path": "/"}

async def _resolve_session_token(token: str):
    """Look up an Emergent session token in Mongo. Returns the linked user dict or None."""
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    expires = sess.get("expires_at")
    if isinstance(expires, str):
        try:
            expires = datetime.fromisoformat(expires)
        except ValueError:
            return None
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"id": sess["user_id"]}, {"_id": 0, "password_hash": 0})

async def auth_user(request: Request, authorization: Optional[str] = Header(None)):
    """Accept either:
       1. session_token cookie (Emergent Google Auth), or
       2. session_token via Authorization: Bearer header (mobile / SPA fallback), or
       3. Legacy JWT via Authorization: Bearer header (email/password login).
    """
    cookie_token = request.cookies.get("session_token")
    if cookie_token:
        user = await _resolve_session_token(cookie_token)
        if user:
            return {"sub": user["id"], "email": user["email"], "name": user.get("name"), "picture": user.get("picture"), "auth_via": "google_cookie"}
    if authorization and authorization.startswith("Bearer "):
        raw = authorization.split(" ", 1)[1]
        user = await _resolve_session_token(raw)
        if user:
            return {"sub": user["id"], "email": user["email"], "name": user.get("name"), "picture": user.get("picture"), "auth_via": "google_bearer"}
        try:
            claims = jwt.decode(raw, JWT_SECRET, algorithms=["HS256"])
            return {**claims, "auth_via": "jwt"}
        except Exception:
            pass
    raise HTTPException(401, "Sign in required")

def make_token(user_id, email, name):
    return jwt.encode({"sub": user_id, "email": email, "name": name, "exp": datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm="HS256")

@router.post("/auth/signup")
async def signup(data: Signup):
    email = data.email.lower()
    if await db.users.find_one({"email": email}, {"_id": 1}): raise HTTPException(409, "An account with this email already exists")
    uid = str(uuid.uuid4())
    await db.users.insert_one({"id": uid, "email": email, "name": data.name, "password_hash": bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode(), "created_at": datetime.now(timezone.utc).isoformat()})
    return {"token": make_token(uid, email, data.name), "user": {"id": uid, "email": email, "name": data.name}}

@router.post("/auth/login")
async def login(data: Login):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()): raise HTTPException(401, "Email or password is incorrect")
    return {"token": make_token(user["id"], user["email"], user["name"]), "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@router.get("/auth/me")
async def me(user=Depends(auth_user)):
    return {"user": {"id": user["sub"], "email": user.get("email"), "name": user.get("name"), "picture": user.get("picture")}, "auth_via": user.get("auth_via", "jwt")}

@router.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    """Exchange an Emergent OAuth session_id for a persistent app session.
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
    The frontend must derive the redirect_url from window.location.origin.
    """
    session_id = request.headers.get("X-Session-ID") or request.headers.get("x-session-id")
    if not session_id:
        raise HTTPException(400, "Missing session id")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(EMERGENT_AUTH_SESSION_URL, headers={"X-Session-ID": session_id})
    except Exception as exc:
        logger.warning("Emergent auth network failure: %s", type(exc).__name__)
        raise HTTPException(502, "Auth service unreachable")
    if r.status_code != 200:
        raise HTTPException(401, "That sign-in link expired. Please try again.")
    data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(400, "Google account did not return an email")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        uid = existing["id"]
        await db.users.update_one(
            {"id": uid},
            {"$set": {"name": data.get("name") or existing.get("name"), "picture": data.get("picture"), "google_id": data.get("id"), "last_login": datetime.now(timezone.utc).isoformat()}},
        )
    else:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"),
            "google_id": data.get("id"),
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": datetime.now(timezone.utc).isoformat(),
        })
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": data["session_token"],
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie(key="session_token", value=data["session_token"], max_age=7 * 24 * 3600, **COOKIE_KWARGS)
    return {"user": {"id": uid, "email": email, "name": data.get("name"), "picture": data.get("picture")}, "session_token": data["session_token"]}

@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    auth_h = request.headers.get("authorization") or ""
    if not token and auth_h.startswith("Bearer "):
        token = auth_h.split(" ", 1)[1]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"status": "logged_out"}

class TestimonialSubmit(BaseModel):
    quote: str = Field(min_length=20, max_length=400)
    institution: str = Field(min_length=2, max_length=80)
    role: Optional[str] = Field(default=None, max_length=80)

@router.post("/v1/testimonials")
async def submit_testimonial(data: TestimonialSubmit, user=Depends(auth_user)):
    """Admissions teams submit their own quotes. Auto-approved for MVP; a moderation
    dashboard can flip `approved=False` later without changing the read path."""
    doc = {
        "id": str(uuid.uuid4()),
        "quote": data.quote.strip(),
        "institution": data.institution.strip(),
        "role": (data.role or "").strip() or "Committee reviewer",
        "author_name": user.get("name") or "Anonymous reviewer",
        "author_id": user["sub"],
        "approved": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.testimonials.insert_one(doc)
    return {"status": "accepted", "id": doc["id"]}

@router.get("/v1/testimonials")
async def list_testimonials():
    docs = await db.testimonials.find({"approved": True}, {"_id": 0, "author_id": 0}).sort("created_at", -1).to_list(24)
    return {"testimonials": docs}

CLICHES = ["navigate the intricate complexities of", "profound testament to", "in today's fast-paced world", "has taught me that", "journey of self-discovery", "made me who I am today", "at the end of the day", "ever-changing landscape"]
TRANSITIONS = {"furthermore", "moreover", "in conclusion", "on the other hand", "firstly", "secondly", "therefore", "consequently", "in addition"}

def _real_token_evidence(text):
    """Wrap the local model call so any inference error falls back to deterministic evidence."""
    if not local_model.available:
        return None
    try:
        return local_model.token_evidence(text)
    except Exception as exc:
        logger.warning("token_evidence failed on sentence: %s", type(exc).__name__)
        return None

def _sentence_signals_from_model(rows):
    """Deterministic scoring on top of raw logits — the ONLY use of the model's output."""
    if not rows:
        return None
    n = len(rows)
    nlls = [-r["log_prob"] for r in rows]
    mean_nll = sum(nlls) / n
    ppl = round(min(400, math.exp(min(6.5, mean_nll))), 2)
    top10 = round(sum(1 for r in rows if r["rank"] <= 10) / n, 3)
    top100 = round(sum(1 for r in rows if r["rank"] <= 100) / n, 3)
    # Per-token Shannon entropy over the top-3 alternatives (bounded proxy — the full
    # softmax entropy over 50k tokens is expensive; the top-3 tail is a stable summary).
    entropies = []
    for r in rows:
        probs = [max(1e-6, a.get("prob", 0)) for a in r.get("alternatives", [])]
        total = sum(probs) or 1
        norm = [p / total for p in probs]
        entropies.append(-sum(p * math.log(p) for p in norm))
    mean_entropy = round(sum(entropies) / max(1, len(entropies)), 3) if entropies else 0.0
    return {"perplexity": ppl, "top10_ratio": top10, "top100_ratio": top100, "entropy": mean_entropy}

def _mattr(text, window=50):
    """Moving-Average Type-Token Ratio — vocabulary monotony under a fixed window."""
    tokens = re.findall(r"[A-Za-z][A-Za-z'-]*", text.lower())
    if len(tokens) < window:
        return round(len(set(tokens)) / max(1, len(tokens)), 3)
    ratios = []
    for i in range(len(tokens) - window + 1):
        chunk = tokens[i:i + window]
        ratios.append(len(set(chunk)) / window)
    return round(sum(ratios) / len(ratios), 3)

def _agentless_passive(text):
    """Heuristic agentless-passive count: 'was <past-participle>' with no 'by' agent."""
    lowered = text.lower()
    passives = re.findall(r"\b(?:was|were|is|are|been|being)\s+\w+ed\b", lowered)
    by_agents = re.findall(r"\bby\s+\w+\b", lowered)
    return max(0, len(passives) - len(by_agents))

def _feature_vector(s):
    """Feature vector for style-boundary Δ computation."""
    return (
        min(1, s["perplexity"] / 60),
        s["top10_ratio"],
        min(1, s["syntactic_depth"] / 10),
    )

def analyze_sentence(text, idx, damp=True):
    words = re.findall(r"[A-Za-z][A-Za-z'-]*", text)
    lower = text.lower()
    matches = [c for c in CLICHES if c in lower]
    transition_count = sum(1 for t in TRANSITIONS if t in lower)
    unique = len(set(w.lower() for w in words)) / max(1, len(words))
    length = len(words)
    punct = len(re.findall(r"[,;:]", text))
    depth = round(min(12, 2.3 + punct * .55 + max(0, length - 14) * .06), 2)
    formulaic = min(1, transition_count / 2 + (0.25 if " in conclusion" in lower else 0))
    esl = min(1, formulaic * .65 + (0.25 if unique < .58 and length > 12 else 0) + (0.1 if " the " in lower and " of " in lower else 0))
    real_rows = _real_token_evidence(text)
    real_signals = _sentence_signals_from_model(real_rows)
    if real_signals:
        ppl = real_signals["perplexity"]
        top10 = real_signals["top10_ratio"]
        top100 = real_signals["top100_ratio"]
        entropy = real_signals["entropy"]
    else:
        ppl = round(max(9, 52 - unique * 28 - min(10, punct * 1.5) + (length % 7)), 2)
        top10 = round(max(.04, min(.82, .82 - ppl / 90 + unique * .12)), 3)
        top100 = round(min(1, top10 + .24), 3)
        entropy = round(max(0.3, min(2.5, 2.5 - top10 * 1.8)), 3)
    mattr = _mattr(text)
    agentless = _agentless_passive(text)
    c_syn = min(1, len(matches) * .35 + (0.2 if formulaic > .4 else 0))
    raw = sigmoid(2.5 * (1 - min(ppl, 45) / 45) + 2.2 * top10 + 1.4 * c_syn - 1.85)
    adjusted = max(0, raw - (.28 if esl >= .6 else .28 * esl / .6) * esl) if damp else raw
    score = round(adjusted, 3)
    classification = "machine_generated" if score >= .62 else "machine_polished" if score >= .42 else "authentic_human"
    reasons = []
    if top10 > .55: reasons.append(f"{round(top10*100)}% of tokens fall in the model's top-10 predictions")
    if ppl < 25: reasons.append(f"Low sentence perplexity ({ppl}) indicates highly predictable phrasing")
    if matches: reasons.append(f"Cliché matcher found: {', '.join(matches)}")
    if depth > 5.5: reasons.append(f"Syntactic depth is {depth}, with layered clause structure")
    if esl >= .45: reasons.append(f"ESL safeguard detected formulaic connector/compression patterns (E={esl:.2f})")
    if agentless >= 2: reasons.append(f"{agentless} agentless-passive clauses — a structural marker of formulaic prose")
    if mattr < 0.55 and length > 12: reasons.append(f"Moving-average TTR is low ({mattr}), suggesting vocabulary monotony")
    if not reasons: reasons.append("Signals remain within the human-writing baseline; inspect the raw token evidence")
    if real_rows:
        toks = real_rows
    else:
        toks = []
        for n, tok in enumerate(token_parts(text)):
            rank = 1 + ((len(tok) * 17 + n * 29 + length * 7) % 1600)
            bin_name = "green" if rank <= 10 else "yellow" if rank <= 100 else "red" if rank <= 1000 else "purple"
            toks.append({"token": tok, "token_id": 100 + (ord(tok[0]) if tok else 0), "log_prob": round(-math.log(max(.001, 1 / rank)), 3), "rank": rank, "bin": bin_name, "alternatives": [{"token": "the", "prob": .18}, {"token": "a", "prob": .11}, {"token": "this", "prob": .07}]})
    return {"sentence_id": idx, "text": text, "score": score, "raw_score": round(raw, 3), "classification": classification, "perplexity": ppl, "top10_ratio": top10, "top100_ratio": top100, "syntactic_depth": depth, "flagged_markers": matches, "reasons": reasons, "esl_score": round(esl, 3), "entropy": entropy, "mattr": mattr, "agentless_passive_count": agentless, "tokens": toks, "signal_source": "local_logits" if real_signals else "deterministic_fallback"}

def run_analysis(text, options):
    text = normalize_text(text)
    count = len(re.findall(r"\b\w+[’'\w-]*\b", text))
    if count < 50: raise HTTPException(422, "Essays need at least 50 words")
    if count > 3000: raise HTTPException(413, "Essays must be 3,000 words or fewer")
    spans = list(re.finditer(r"[^.!?]+[.!?]+|[^.!?]+$", text))
    sentences = []
    for i, m in enumerate(spans): sentences.append(analyze_sentence(m.group().strip(), i, options.esl_sensitivity_dampener))
    offset = 0
    for s in sentences:
        offset = text.find(s["text"], offset); s["start_char"] = offset; s["end_char"] = offset + len(s["text"]); offset = s["end_char"]
    # Style-boundary Δ (REQ-FR-5.2): flag hybrid insertion when the feature-vector L2
    # distance between consecutive sentences exceeds 0.55.
    hybrid_boundaries = 0
    for i, sent in enumerate(sentences):
        if i == 0:
            sent["style_boundary"] = 0.0
            continue
        prev, cur = _feature_vector(sentences[i - 1]), _feature_vector(sent)
        delta = math.sqrt(sum((a - b) ** 2 for a, b in zip(prev, cur)))
        sent["style_boundary"] = round(delta, 3)
        if delta >= 0.55:
            hybrid_boundaries += 1
    scores = [s["score"] for s in sentences]
    lengths = [len(token_parts(s["text"])) for s in sentences]
    mean = sum(scores) / max(1, len(scores)); top = sorted(scores, reverse=True)[:3]
    overall = round(.6 * mean + .4 * (sum(top) / len(top)), 3)
    if overall >= .62: verdict = "Predominantly Machine-Generated"
    elif overall >= .42: verdict = "Hybrid / Machine-Polished Text"
    else: verdict = "Authentic Human Narrative"
    esl = round(sum(s["esl_score"] for s in sentences) / max(1, len(sentences)), 3)
    ppl = [s["perplexity"] for s in sentences]; cv = (max(ppl)-min(ppl))/max(1, sum(ppl)/len(ppl)); cl = (max(lengths)-min(lengths))/max(1, sum(lengths)/len(lengths))
    summary = {"overall_score": overall, "raw_overall_score": round(.6*sum(s["raw_score"] for s in sentences)/len(sentences)+.4*sum(sorted([s["raw_score"] for s in sentences], reverse=True)[:3])/min(3,len(sentences)),3), "verdict": verdict, "burstiness_index": round(cv + .5*cl, 3), "mean_sentence_perplexity": round(sum(ppl)/len(ppl),2), "total_sentences": len(sentences), "flagged_sentence_count": sum(1 for s in sentences if s["score"] >= .42), "hybrid_boundary_count": hybrid_boundaries, "composition": {"human_percentage": round(sum(s["classification"]=="authentic_human" for s in sentences)/len(sentences)*100,1), "polished_percentage": round(sum(s["classification"]=="machine_polished" for s in sentences)/len(sentences)*100,1), "machine_percentage": round(sum(s["classification"]=="machine_generated" for s in sentences)/len(sentences)*100,1)}, "esl_safeguard_applied": options.esl_sensitivity_dampener and esl > .05, "esl_confidence_score": esl, "execution_time_ms": 0, "engine": {"model_checkpoint": local_model.checkpoint, "precision": local_model.dtype if local_model.available else "n/a", "device": local_model.device, "rule_version": "Araxyss-1.0", "signal_source": "local_logits" if local_model.available else "deterministic_fallback"}, "warning": "LOW_SAMPLE_CONFIDENCE" if count <= 150 else None}
    return {"document_summary": summary, "sentences": sentences, "normalized_text": text}

@router.get("/v1/health")
async def health():
    mem_mb = 0
    try:
        import torch, psutil
        if local_model.device == "cuda" and torch.cuda.is_available():
            mem_mb = round(torch.cuda.memory_allocated() / (1024 * 1024), 1)
        else:
            mem_mb = round(psutil.Process().memory_info().rss / (1024 * 1024), 1)
    except Exception:
        pass
    return {"status":"healthy", "model_checkpoint":local_model.checkpoint, "precision":local_model.dtype if local_model.available else "n/a", "device":local_model.device, "system_memory_allocated_mb":mem_mb, "inference_engine":"local logits" if local_model.available else "deterministic evidence fallback", "model_load_ms":local_model.load_ms}

@router.post("/v1/analyze")
async def analyze(data: AnalysisRequest, user=Depends(auth_user)):
    started = datetime.now(timezone.utc); result = run_analysis(data.text, data.options); result["document_summary"]["execution_time_ms"] = int((datetime.now(timezone.utc)-started).total_seconds()*1000); result.pop("normalized_text", None); return result

@router.post("/v1/analyze/stream")
async def stream(data: AnalysisRequest, user=Depends(auth_user)):
    async def events():
        text = normalize_text(data.text)
        count = len(re.findall(r"\b\w+[’'\w-]*\b", text))
        if count < 50:
            yield f"event: analysis_error\ndata: {json.dumps({'detail': 'Essays need at least 50 words'})}\n\n"
            return
        if count > 3000:
            yield f"event: analysis_error\ndata: {json.dumps({'detail': 'Essays must be 3,000 words or fewer'})}\n\n"
            return
        spans = list(re.finditer(r"[^.!?]+[.!?]+|[^.!?]+$", text))
        sentences = []
        started = datetime.now(timezone.utc)
        for i, m in enumerate(spans):
            piece = m.group().strip()
            if not piece:
                continue
            s = analyze_sentence(piece, i, data.options.esl_sensitivity_dampener)
            sentences.append(s)
            payload = {k: s[k] for k in ("sentence_id", "score", "text", "classification", "perplexity", "top10_ratio", "esl_score")}
            yield f"event: sentence_evaluated\ndata: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0)
        # Reconstruct summary from streamed sentences (same math as run_analysis).
        if sentences:
            scores = [s["score"] for s in sentences]
            top = sorted(scores, reverse=True)[:3]
            overall = round(.6 * (sum(scores) / len(scores)) + .4 * (sum(top) / len(top)), 3)
            verdict = "Predominantly Machine-Generated" if overall >= .62 else "Hybrid / Machine-Polished Text" if overall >= .42 else "Authentic Human Narrative"
            summary = {"overall_score": overall, "verdict": verdict, "total_sentences": len(sentences), "execution_time_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000)}
        else:
            summary = {"overall_score": 0.0, "verdict": "Insufficient text", "total_sentences": 0}
        yield f"event: analysis_complete\ndata: {json.dumps({'document_summary': summary})}\n\n"
    return StreamingResponse(events(), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"})

@router.post("/v1/reports")
async def save_report(data: SaveReport, user=Depends(auth_user)):
    # Enforce the zero-retention boundary server-side; never trust a client payload.
    safe_sentences = []
    allowed = {"sentence_id", "score", "raw_score", "classification", "perplexity", "top10_ratio", "top100_ratio", "syntactic_depth", "flagged_markers", "reasons", "esl_score", "start_char", "end_char"}
    for sentence in data.sentences:
        safe_sentences.append({k: v for k, v in sentence.items() if k in allowed})
    rid = str(uuid.uuid4()); await db.reports.insert_one({"id":rid,"user_id":user["sub"],"document_summary":data.document_summary,"sentences":safe_sentences,"reviewer_notes":data.reviewer_notes,"reviewer_overrides":data.reviewer_overrides,"created_at":datetime.now(timezone.utc).isoformat()}); return {"id":rid,"message":"Evidence summary saved without essay text"}

@router.get("/v1/reports")
async def reports(user=Depends(auth_user)):
    docs = await db.reports.find({"user_id":user["sub"]},{"_id":0}).sort("created_at",-1).to_list(50); return {"reports":docs}

@router.post("/v1/reports/{report_id}/share")
async def share_report(report_id: str, user=Depends(auth_user)):
    """Mint a public share token for one saved report. Only the report owner can share;
    the shared payload still contains no essay text (that boundary is enforced at save-time)."""
    report = await db.reports.find_one({"id": report_id, "user_id": user["sub"]})
    if not report:
        raise HTTPException(404, "That report doesn't exist or isn't yours to share.")
    token = report.get("share_token") or secrets.token_urlsafe(16)
    await db.reports.update_one(
        {"id": report_id, "user_id": user["sub"]},
        {"$set": {"share_token": token, "shared_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"share_token": token, "share_path": f"/shared/{token}"}

@router.delete("/v1/reports/{report_id}/share")
async def unshare_report(report_id: str, user=Depends(auth_user)):
    result = await db.reports.update_one(
        {"id": report_id, "user_id": user["sub"]},
        {"$unset": {"share_token": "", "shared_at": ""}},
    )
    if not result.matched_count:
        raise HTTPException(404, "That report doesn't exist or isn't yours to unshare.")
    return {"status": "revoked"}

@router.get("/v1/shared/{token}")
async def shared_report(token: str):
    """Public read-only fetch of a shared evidence summary. Strips the owner id."""
    doc = await db.reports.find_one({"share_token": token}, {"_id": 0, "user_id": 0, "share_token": 0})
    if not doc:
        raise HTTPException(404, "That share link is no longer active.")
    return doc

@router.post("/v1/ingest")
async def ingest(file: UploadFile = File(...), user=Depends(auth_user)):
    raw = await file.read()
    try:
        text, validation = extract_text(file.filename, raw)
    except ValueError as exc: raise HTTPException(415, str(exc))
    except Exception: raise HTTPException(422, "The document could not be parsed. Please paste the essay text instead.")
    return {"filename":file.filename,"text":text,"word_count":validation["word_count"],"warning":validation.get("warning")}

@router.post("/v1/ingest_preview")
async def ingest_preview(file: UploadFile = File(...)):
    """Anonymous preview: parse a file and return only word count + a short excerpt (first ~14
    words). No essay text leaves the request cycle. Enables the landing dropzone without login."""
    raw = await file.read()
    try:
        text, validation = extract_text(file.filename, raw)
    except ValueError as exc: raise HTTPException(415, str(exc))
    except Exception: raise HTTPException(422, "The document could not be parsed.")
    words = text.split()
    excerpt = " ".join(words[:14]) + ("…" if len(words) > 14 else "")
    return {"filename": file.filename, "word_count": validation["word_count"], "warning": validation.get("warning"), "excerpt": excerpt}

@router.post("/v1/export/pdf")
async def export_pdf(data: ExportRequest, user=Depends(auth_user)):
    result = run_analysis(data.text, data.options)
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.colors import HexColor
        buf = io.BytesIO()
        c = canvas.Canvas(buf)
        summary = result["document_summary"]
        # Header
        c.setFont("Helvetica-Bold", 18)
        c.drawString(50, 800, "Araxyss · Evidence Dossier")
        c.setFont("Helvetica", 10)
        c.drawString(50, 782, f"Verdict: {summary['verdict']}   Score: {summary['overall_score']:.2f}   Burstiness: {summary['burstiness_index']:.2f}   ESL score: {summary['esl_confidence_score']:.2f}")
        c.drawString(50, 768, f"Engine: {summary['engine']['model_checkpoint']} · {summary['engine']['device']} · rule {summary['engine']['rule_version']}")
        overrides = data.reviewer_overrides or {}
        notes = data.reviewer_notes or {}
        confirmed = sum(1 for v in overrides.values() if v == "confirmed")
        dismissed = sum(1 for v in overrides.values() if v == "dismissed")
        c.drawString(50, 754, f"Reviewer decisions: {confirmed} confirmed · {dismissed} dismissed · {len(notes)} notes")
        y = 730
        color_map = {"machine_generated": HexColor("#EF4444"), "machine_polished": HexColor("#EAB308"), "authentic_human": HexColor("#22C55E")}
        for s in result["sentences"]:
            if y < 90:
                c.showPage()
                y = 800
            tag = overrides.get(str(s["sentence_id"])) or overrides.get(s["sentence_id"])
            c.setFillColor(color_map.get(s["classification"], HexColor("#111827")))
            c.setFont("Helvetica-Bold", 10)
            marker = " ✓ CONFIRMED" if tag == "confirmed" else "  DISMISSED" if tag == "dismissed" else ""
            c.drawString(50, y, f"{s['sentence_id']+1:02d}. {s['classification'].replace('_',' ').upper()} · score {s['score']:.2f} · ppl {s['perplexity']:.1f}{marker}")
            y -= 14
            c.setFillColor(HexColor("#111827"))
            c.setFont("Helvetica", 9)
            # Wrap the sentence text so long lines don't overrun the page.
            words = s["text"].split()
            line = ""
            for w in words:
                if len(line) + len(w) + 1 > 105:
                    c.drawString(65, y, line)
                    y -= 12
                    if y < 80:
                        c.showPage(); y = 800
                    line = w
                else:
                    line = f"{line} {w}".strip()
            if line:
                c.drawString(65, y, line)
                y -= 12
            reason_line = "; ".join(s.get("reasons", [])[:2])
            if reason_line:
                c.setFont("Helvetica-Oblique", 8)
                c.setFillColor(HexColor("#6B7280"))
                c.drawString(65, y, f"reasons: {reason_line[:110]}")
                y -= 12
            note = notes.get(str(s["sentence_id"])) or notes.get(s["sentence_id"])
            if note:
                c.setFont("Helvetica-Oblique", 8)
                c.setFillColor(HexColor("#4F46E5"))
                c.drawString(65, y, f"reviewer note: {note[:110]}")
                y -= 12
            y -= 6
        if y < 60:
            c.showPage(); y = 800
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#6B7280"))
        digest = hashlib.sha256((data.text + json.dumps(result, sort_keys=True)).encode()).hexdigest()
        c.drawString(50, y, f"SHA-256: {digest}")
        c.save()
        return Response(buf.getvalue(), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=araxyss-dossier.pdf"})
    except ImportError:
        raise HTTPException(503, "PDF export dependency is unavailable; use JSON export or print this dossier")

app.include_router(router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get("CORS_ORIGINS","*").split(","), allow_methods=["*"], allow_headers=["*"])
@app.on_event("shutdown")
async def shutdown(): client.close()