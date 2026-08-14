# EAIA — Explainable AI Essay Auditor · PRD

## Problem
Admissions readers need sentence-level, evidence-backed AI-likelihood analysis of essays — not a bare percentage. Every flagged sentence must be one click from the raw numbers that produced it.

## Non-Negotiable Constraints
- **CON-01** No black-box verdicts: the local LM is used only for raw next-token logits/log-probs. All scoring is deterministic code on those numbers.
- **CON-04** Zero essay retention. Essay text lives in volatile RAM only; never persisted.
- Explainability: every score → raw evidence (rank bins, perplexity, cliché n-grams, syntactic depth).
- ESL fairness safeguard (toggleable, visible).

## Users
- Admissions reviewers scanning essays for signals of machine-generated text.

## Core Requirements (P0 — done)
- Auth (email/password, JWT, bcrypt) — Mongo `users` collection.
- Document ingestion (TXT/PDF/DOCX) with normalization.
- Local causal-LM inference (GPT-2 on CPU, FP16 on GPU) producing per-token rank/log-prob/top-3 alternatives.
- Deterministic scoring: PPL, GLTR bins, top-10 ratio, syntactic depth, cliché matcher, ESL damping, sigmoid fusion.
- SSE streaming (`/api/v1/analyze/stream`) with per-sentence pulse.
- Reviewer overrides (Confirm / Dismiss) per sentence in the evidence drawer.
- PDF & JSON dossier export.
- Saved reports store **only** scored output + reviewer notes (never raw text).
- `/methodology` page with dataset card + benchmark numbers + ESL disparity + error analysis.

## Architecture
- **Backend:** FastAPI + Motor (MongoDB) at `:8001`. Torch + Transformers load `gpt2` at startup (HF_HOME → `/var/eaia_hf_cache`). Deterministic fallback if model unavailable.
- **Frontend:** React (CRA) + react-router; single `App.js` orchestrates landing, auth, dashboard, methodology, reports.
- **Endpoints:** `/api/auth/*`, `/api/v1/health`, `/api/v1/analyze`, `/api/v1/analyze/stream`, `/api/v1/ingest`, `/api/v1/reports`, `/api/v1/export/pdf`.

## Implemented (2026-02-14)
- Real local-logits inference wired into `analyze_sentence`; deterministic fallback preserved.
- Health endpoint reports actual checkpoint/device/RSS.
- Fixed double `overrides` state bug in `App.js` (was crashing dashboard).
- Reviewer Confirm/Dismiss overrides render, toggle active state, and persist in save payload.
- Engine metadata (`signal_source: local_logits`) surfaced to clients.

## Backlog
- **P1**: Wire SSE stream to also use real logits (currently sync path uses them; SSE re-runs same path — verify perf).
- **P1**: Larger held-out ESL corpus so disparity numbers move past low-confidence.
- **P1**: Attach reviewer overrides + notes into PDF dossier body (currently only in JSON export).
- **P2**: Optional Google OAuth (deferred).
- **P2**: Latency reporting card on `/methodology` sourced from live `/health`.
