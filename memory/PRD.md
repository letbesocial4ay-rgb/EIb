# EAIA — Explainable AI Essay Auditor

## Original problem statement
Build a full-stack explainable essay auditing tool for admissions reviewers. It must expose sentence-level evidence, use local model numbers rather than conversational authorship judgments, apply an ESL safeguard, preserve zero essay retention, support auth, exports, reports, methodology, and streaming analysis.

## Architecture decisions
- Existing Emergent starter remains React + FastAPI + MongoDB; the locked product behavior is implemented over the provided runtime.
- FastAPI owns email/password auth, deterministic analysis, ingestion, SSE, export, and summary-only reports.
- Frontend holds essay text and analysis in memory; MongoDB stores account identity and opted-in scored summaries only.
- The current inference adapter exposes GLTR-shaped evidence deterministically and advertises the Llama 3.2 1B → GPT-2 fallback path for local model wiring.

## User personas
- Admissions reader: quickly inspects sentence risk and raw evidence.
- Academic integrity / ESL reviewer: compares safeguards, fairness signals, and reviewer notes.

## Core requirements (static)
Auth; 50–3,000-word validation; text/upload input; sentence spans; PPL/top-rank/GLTR/syntax/cliché evidence; ESL toggle; streaming-capable API; JSON and print/PDF workflow; optional summary-only reports; public methodology and limitations; accessible responsive UI.

## Implemented (2026-08-14)
- Editorial landing, signup/login/logout, protected workspace, reports, methodology routes.
- FastAPI auth with hashed passwords and JWT sessions.
- Deterministic per-sentence engine with evidence tokens, rank bins, reasons, burstiness, composition, ESL damping, verdicts, and metadata.
- Upload/paste flow, word validation, sentence heatmap, evidence drawer, reviewer notes, JSON export, print stylesheet, report saving, SSE endpoint.
- Server-side report allowlist prevents sentence text or token payloads from persisting.
- Lint, build, API smoke, browser flow, and e2e acceptance checks completed.

## Prioritized backlog
- P0: Wire optional local Transformers model loader and measure real CPU/GPU latency.
- P1: Implement pdfplumber/python-docx extraction rather than the current text upload fallback message.
- P1: Build a real held-out four-quadrant dataset and run benchmark/error-analysis scripts.
- P2: Add true PDF dossier generation in environments with ReportLab/WeasyPrint installed.
- P2: Add reviewer override controls and richer report detail views.

## Remaining next tasks
1. Validate Llama 3.2 1B availability and implement raw logit adapter with OOM fallback.
2. Add document parser dependencies and unit tests for PDF/DOCX normalization.
3. Replace the small methodology card with measured benchmark numbers and three genuine errors.
4. Record honest latency and ESL FPR disparity from the held-out corpus.
