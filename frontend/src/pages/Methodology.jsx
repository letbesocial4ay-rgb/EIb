import { ShieldCheck, Braces, Sigma, Layers, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Methodology() {
  return (
    <div className="content-page methodology">
      <div className="mth-hero">
        <div className="eyebrow"><ShieldCheck size={13} /> Public methodology</div>
        <h1>Evidence, not certainty.</h1>
        <p>
          Araxyss is an instrument for structured review — not an authorship judge. The local
          causal LM produces raw token signals; deterministic code computes every score you see.
        </p>
      </div>

      <section className="mth-grid">
        <article data-cursor="hover">
          <span className="num">01</span>
          <Sigma size={16} />
          <h2>What we measure</h2>
          <p>
            Sentence perplexity, exact 1-based vocabulary rank, GLTR 4-color bins,
            per-token Shannon entropy, moving-average TTR, dependency depth, cliché n-grams,
            burstiness, and style-boundary Δ. Every score is one click from its inputs.
          </p>
        </article>
        <article data-cursor="hover">
          <span className="num">02</span>
          <Layers size={16} />
          <h2>Fairness guardrail</h2>
          <p>
            The ESL safeguard detects formulaic transitions, low-TTR-but-common-vocab compression,
            and idiosyncratic collocations. It applies a visible damping factor (δ = 0.28 at E ≥ 0.60)
            and can be toggled off for direct comparison.
          </p>
        </article>
        <article data-cursor="hover">
          <span className="num">03</span>
          <Braces size={16} />
          <h2>Honest limits</h2>
          <p>
            Current held-out sample: 16 essays. Precision 0.500 · Recall 1.000 · F1 0.667 · ROC-AUC 1.000.
            Native FPR 1.000, ESL FPR 1.000, |Δ| 0.000. All figures low-confidence at n=4 per group.
            Results are directional and should never drive an admissions decision alone.
          </p>
        </article>
      </section>

      <section className="dataset-card">
        <div className="dc-copy">
          <div className="eyebrow">Dataset card · Araxyss-1.0</div>
          <h2>What this system does not cover</h2>
          <p>
            The current sample is common-app-style English narratives. Supplemental short-answer
            prompts, STEM-heavy essays, other languages, and many L1 backgrounds are untested.
            The benchmark report is intentionally marked low-confidence until a held-out corpus
            of sufficient size is assembled.
          </p>
          <Link to="/signup" className="link-arrow" data-cursor="hover">
            Open the workspace <ArrowRight size={14} />
          </Link>
        </div>
        <div className="dc-stats">
          <div><b>4</b><span>signal families</span></div>
          <div><b>0</b><span>essays retained</span></div>
          <div><b>1.0</b><span>rule version</span></div>
          <div><b>GPT-2</b><span>local checkpoint</span></div>
        </div>
      </section>

      <section className="mth-errors">
        <div className="eyebrow">Error analysis · three real misclassifications</div>
        <div className="err-grid">
          <div className="err" data-cursor="hover">
            <span className="err-tag red">False positive</span>
            <p><b>Native speaker, list-like structure.</b> The essay uses simple, common vocabulary in short parallel clauses. Low PPL + high top-10 ratio triggered a machine-polished flag even though a human wrote it that way on purpose.</p>
          </div>
          <div className="err" data-cursor="hover">
            <span className="err-tag amber">Missed hybrid</span>
            <p><b>Two-sentence LLM polish.</b> Only two sentences were rewritten. The style-boundary Δ was 0.41 — below the 0.55 threshold — so the pipeline classified the essay as human. A larger held-out set would let us tighten this threshold.</p>
          </div>
          <div className="err" data-cursor="hover">
            <span className="err-tag purple">ESL over-damping</span>
            <p><b>Fluent ESL applicant with LLM polish.</b> The ESL safeguard damped the score to human-baseline because the writer already used formulaic connectors organically. The damping reduced a real signal.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
