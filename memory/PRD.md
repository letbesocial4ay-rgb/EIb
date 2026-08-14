# Araxyss — Explainable AI Essay Auditor · PRD

> Rebrand of EAIA. Feb 2026 build.

## Problem
Admissions readers need sentence-level, evidence-backed AI-likelihood analysis of essays — not a bare percentage. Every flagged sentence must be one click from the raw numbers that produced it.

## Non-Negotiable Constraints
- **CON-01** No black-box verdicts: the local LM is used only for raw next-token logits/log-probs. All scoring is deterministic code on those numbers.
- **CON-04** Zero essay retention. Essay text lives in volatile RAM only; never persisted.
- Explainability: every score → raw evidence (rank bins, perplexity, cliché n-grams, entropy, MATTR, syntactic depth, style boundary Δ).
- ESL fairness safeguard (toggleable, visible).

## Users
- Admissions reviewers scanning essays for signals of machine-generated text.
- Public visitors previewing capabilities via the landing dropzone.

## Core Requirements (P0 — done)
- Auth (email/password, JWT, bcrypt) — Mongo `users` collection.
- **Anonymous ingest_preview** (word count + excerpt only, no login) on landing hero.
- Document ingestion (TXT/PDF/DOCX) with normalization + metadata stripping.
- Local causal-LM inference (GPT-2 on CPU, FP16 on GPU) producing per-token rank/log-prob/top-3 alternatives.
- Deterministic scoring: PPL, GLTR bins, top-10 ratio, syntactic depth, cliché matcher, ESL damping, sigmoid fusion.
- **Per-sentence Shannon entropy** over top-3 alternatives.
- **Moving-Average Type-Token Ratio (MATTR, window=50)** for vocabulary monotony.
- **Agentless-passive heuristic** — reason line if ≥ 2.
- **Style-boundary Δ (REQ-FR-5.2)** — L2 distance of feature vectors between consecutive sentences; flags hybrid insertion at Δ ≥ 0.55; shown as a reason.
- **Hybrid boundary count** in document summary.
- SSE streaming (`/api/v1/analyze/stream`) with per-sentence pulse.
- Reviewer overrides (Confirm / Dismiss) per sentence — mapped into PDF dossier.
- PDF & JSON dossier export — reviewer notes/overrides now embedded in PDF.
- Saved reports store **only** scored output + reviewer notes (never raw text).
- `/methodology` page with dataset card + benchmark numbers + ESL disparity + 3 error cases.

## UX / Design System (Feb 2026 overhaul)
- **Brand:** Araxyss — SVG mark: bracket-flanked "A" over GLTR rank-bin strip.
- **Fonts:** Cormorant Garamond (display), JetBrains Mono (UI/data), Playfair Display (essay body).
- **Landing** (dark): 3D constellation of floating GLTR-colored token spheres with animated evidence splines (React Three Fiber). Magnetic-button hover, custom two-part cursor (dot + lag ring, mix-blend difference), parallax orbs, framer-motion reveals.
- **PDF dropzone** on landing hero with drag-active glow, live word-count + excerpt preview, "Sign in to analyze" CTA.
- **Workspace** (light): calm document layout — 60/40 split, essay in Playfair on the left, sticky evidence drawer on the right with metric grid, ESL toggle, Confirm/Dismiss decision, GLTR token ribbon.
- **Auth**: split cinematic left panel with orbiting GLTR dots + calm form on the right.
- **Methodology**: editorial dark layout with numbered signal-family cards, dataset card, and 3 real-error case studies.
- **Reports**: private dark archive of scored summaries.

## Architecture
- **Backend:** FastAPI + Motor (MongoDB) at `:8001`. Torch + Transformers load `gpt2` at startup (`HF_HOME=/app/backend/.hf_cache`). Deterministic fallback if model unavailable.
- **Frontend:** React 19 + react-router. React Three Fiber 9 + drei 9 + framer-motion 11 + react-dropzone 14.
  - Files: `App.js` (router), `components/{Logo,Shell,CustomCursor,Constellation}.jsx`, `pages/{Landing,Auth,Dashboard,Methodology,Reports}.jsx`, `lib/session.js`, `App.css`.
- **Endpoints:** `/api/auth/*`, `/api/v1/health`, `/api/v1/analyze`, `/api/v1/analyze/stream`, `/api/v1/ingest`, `/api/v1/ingest_preview` (anonymous), `/api/v1/reports`, `/api/v1/export/pdf`.

## Implemented (2026-02-14)
- Complete rebrand EAIA → Araxyss (backend title, PDF header, engine.rule_version, UI, PRD).
- Custom SVG logo with GLTR rank-bin motif.
- 3D constellation landing scene (r3f 9 + drei 9, works with React 19).
- Custom two-part cursor with mix-blend-mode.
- Magnetic buttons + parallax orbs + framer-motion reveals.
- Anonymous `/api/v1/ingest_preview` endpoint so landing dropzone works without login.
- Landing hero + capabilities + preview mock + footer.
- Auth pages split-pane with orbiting GLTR dots.
- Methodology page with 3 error-case cards.
- Reviewer overrides Confirm/Dismiss buttons, active state, checkmark icon on confirmed sentences.
- PDF export now includes reviewer confirm/dismiss markers, reviewer notes, and colored classification headers.
- New engine metrics surfaced in evidence drawer: Entropy, MATTR, Depth, style-boundary Δ.

## Backlog
- **P1**: Reviewer keyboard shortcuts (n/p navigation, c/d confirm/dismiss).
- **P1**: Batch mode — analyze multiple essays and compare.
- **P1**: spaCy-based dependency depth (currently punctuation-heuristic) if a small model can be bundled.
- **P1**: Larger held-out ESL corpus so disparity numbers move past low-confidence at n=4.
- **P2**: Optional Google OAuth (deferred).
- **P2**: Live SSE progress bar on the landing preview.
- **P2**: Aho-Corasick trie (current substring match is fine at N=8 clichés; upgrade needed if trope dict grows).
