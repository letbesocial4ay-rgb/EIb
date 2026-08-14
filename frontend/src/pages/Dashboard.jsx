import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  FileUp, BookOpen, ArrowRight, Download, Save, AlertTriangle, CheckCircle2,
  XCircle, LockKeyhole, Sigma, Layers, Braces, Share2, Copy,
} from "lucide-react";
import { API } from "../lib/session";

const demoEssay = `When I moved to a new city, I carried one small notebook and a question I could not answer. At first, every classroom felt like a locked door. I began volunteering at the neighborhood library, where a patient librarian showed me that curiosity is a practice rather than a personality trait. Over time, I learned to listen before offering solutions. That habit changed the way I worked with my robotics team and the way I understood my own mistakes. The experience taught me that meaningful growth rarely arrives as a dramatic moment. It emerges through small decisions, repeated attention, and the courage to revise an easy answer. Today, I still keep that notebook beside my desk, not as a record of certainty, but as an invitation to keep asking better questions.`;

function risk(score) {
  return score >= 0.62 ? "red" : score >= 0.42 ? "amber" : "green";
}

function Metric({ label, value, tone }) {
  return (
    <div className="w-metric">
      <span className="w-metric-label">{label}</span>
      <strong className={tone ? `tone-${tone}` : ""}>{value}</strong>
    </div>
  );
}

export default function Dashboard({ session }) {
  const [text, setText] = useState(() => sessionStorage.getItem("araxyss.pending_text") || "");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(0);
  const [esl, setEsl] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState({});
  const [overrides, setOverrides] = useState({});
  const [saved, setSaved] = useState(false);
  const [savedReportId, setSavedReportId] = useState(null);
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => { sessionStorage.removeItem("araxyss.pending_text"); }, []);
  const s = result?.sentences?.[selected];

  const analyze = async () => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (words > 3000) {
      setError("This essay is over the 3,000-word limit. Trim it down and try again.");
      return;
    }
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const r = await axios.post(
        `${API}/v1/analyze`,
        { text, options: { include_token_details: true, esl_sensitivity_dampener: esl } },
        { headers: { Authorization: `Bearer ${session.token}` } }
      );
      setResult(r.data);
      setSelected(0);
    } catch (x) {
      const detail = x.response?.data?.detail;
      setError(Array.isArray(detail) ? "Please check the form and try again" : detail || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const r = await axios.post(
      `${API}/v1/reports`,
      {
        document_summary: result.document_summary,
        sentences: result.sentences.map(({ tokens, ...s }) => s),
        reviewer_notes: notes,
        reviewer_overrides: overrides,
      },
      { headers: { Authorization: `Bearer ${session.token}` } }
    );
    setSaved(true);
    setSavedReportId(r.data.id);
  };

  const shareSaved = async () => {
    if (!savedReportId) return;
    const r = await axios.post(
      `${API}/v1/reports/${savedReportId}/share`,
      {},
      { headers: { Authorization: `Bearer ${session.token}` } }
    );
    const url = `${window.location.origin}${r.data.share_path}`;
    setShareUrl(url);
    try { await navigator.clipboard.writeText(url); } catch {}
  };

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ ...result, reviewer_overrides: overrides, reviewer_notes: notes }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "araxyss-analysis.json";
    a.click();
  };

  const exportPdf = async () => {
    const r = await axios.post(
      `${API}/v1/export/pdf`,
      { text, options: { include_token_details: true, esl_sensitivity_dampener: esl }, reviewer_overrides: overrides, reviewer_notes: notes },
      { headers: { Authorization: `Bearer ${session.token}` }, responseType: "blob" }
    );
    const blob = new Blob([r.data], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "araxyss-dossier.pdf";
    a.click();
  };

  return (
    <div className="workspace" data-testid="dashboard-root">
      <div className="workspace-head">
        <div>
          <div className="eyebrow">Private analysis room</div>
          <h1>Review an essay</h1>
          <p>Pick a sentence to inspect its raw signals and reviewer context.</p>
        </div>
        {result && (
          <div className="score-lockup" data-testid="document-score">
            <span>Document signal</span>
            <strong className={`tone-${risk(result.document_summary.overall_score)}`}>
              {result.document_summary.overall_score.toFixed(2)}
            </strong>
            <small>{result.document_summary.verdict}</small>
          </div>
        )}
      </div>

      {!result ? (
        <div className="input-stage">
          <div className="input-toolbar">
            <span className="toolbar-label"><BookOpen size={15} /> Essay input</span>
            <div className="input-actions">
              <label className="btn-ghost small" data-testid="upload-file-button" data-cursor="hover">
                <FileUp size={13} /> Upload file
                <input
                  type="file"
                  accept=".txt,.pdf,.docx"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append("file", file);
                    try {
                      const r = await axios.post(`${API}/v1/ingest`, fd, {
                        headers: { Authorization: `Bearer ${session.token}` },
                      });
                      setText(r.data.text);
                      setError("");
                    } catch (x) {
                      setError("This file could not be read. Paste the essay text instead.");
                    }
                  }}
                />
              </label>
              <button className="btn-ghost small" data-testid="load-sample-button" onClick={() => setText(demoEssay)} data-cursor="hover">
                Load sample
              </button>
              <span className="privacy-chip"><LockKeyhole size={12} /> volatile memory</span>
            </div>
          </div>
          <textarea
            data-testid="essay-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste an essay here, or load the sample to explore the evidence view…"
          />
          <div className="input-footer">
            <span data-testid="word-count">
              {text.trim() ? text.trim().split(/\s+/).length : 0} words · 50–3,000 accepted
            </span>
            <button
              className="btn-primary"
              data-testid="analyze-button"
              onClick={analyze}
              disabled={loading || !text.trim()}
              data-cursor="hover"
            >
              {loading ? "Reading signals…" : "Analyze essay"}
              <ArrowRight size={15} />
            </button>
          </div>
          {error && (
            <div className="error-box" data-testid="analysis-error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>
      ) : (
        <div className="review-grid">
          <section className="essay-pane">
            <div className="pane-top">
              <span><BookOpen size={14} /> Evidence heatmap</span>
              <button
                className="btn-ghost small"
                data-testid="reset-analysis-button"
                onClick={() => {
                  setResult(null);
                  setSaved(false);
                }}
                data-cursor="hover"
              >
                New essay
              </button>
            </div>
            <div className="essay-paper">
              {result.sentences.map((row, i) => (
                <button
                  key={row.sentence_id}
                  data-testid={`sentence-${i}-button`}
                  className={`sentence ${i === selected ? "selected" : ""} tone-${risk(row.score)} ${overrides[i] ? `override-${overrides[i]}` : ""}`}
                  onClick={() => setSelected(i)}
                  data-cursor="hover"
                >
                  <span className="sentence-index">{String(i + 1).padStart(2, "0")}</span>
                  {row.text}
                  {overrides[i] === "confirmed" && <CheckCircle2 size={13} className="override-mark" />}
                  {overrides[i] === "dismissed" && <XCircle size={13} className="override-mark" />}
                </button>
              ))}
            </div>
            <div className="legend">
              <span><i className="risk-dot green" /> Human baseline</span>
              <span><i className="risk-dot amber" /> Review signal</span>
              <span><i className="risk-dot red" /> High signal</span>
            </div>
          </section>

          <aside className="evidence-pane">
            <div className="evidence-head">
              <div>
                <div className="eyebrow">Evidence drawer</div>
                <h2>Sentence {String(selected + 1).padStart(2, "0")}</h2>
              </div>
              <span className={`badge tone-${risk(s.score)}`}>
                {s.classification.replaceAll("_", " ")}
              </span>
            </div>

            <p className="selected-quote">"{s.text}"</p>

            <div className="metric-grid">
              <Metric label="Score" value={s.score.toFixed(2)} tone={risk(s.score)} />
              <Metric label="Perplexity" value={s.perplexity} />
              <Metric label="Top-10" value={`${Math.round(s.top10_ratio * 100)}%`} />
              <Metric label="Depth" value={s.syntactic_depth} />
              {s.entropy !== undefined && <Metric label="Entropy" value={s.entropy} />}
              {s.mattr !== undefined && <Metric label="MATTR" value={s.mattr} />}
            </div>

            <div className="w-row">
              <div>
                <b>ESL safeguard</b>
                <small>Dampens formulaic-connector penalty</small>
              </div>
              <button
                className={`w-switch ${esl ? "on" : ""}`}
                data-testid="esl-safeguard-toggle"
                onClick={() => setEsl(!esl)}
                aria-pressed={esl}
                data-cursor="hover"
              >
                <span />
              </button>
            </div>

            <div className="w-row">
              <div>
                <b>Reviewer decision</b>
                <small>Your judgment travels with the dossier</small>
              </div>
              <div className="decision-buttons">
                <button
                  className={`w-decision ${overrides[selected] === "confirmed" ? "active green" : ""}`}
                  data-testid="override-confirm-button"
                  onClick={() => setOverrides({ ...overrides, [selected]: overrides[selected] === "confirmed" ? undefined : "confirmed" })}
                  data-cursor="hover"
                >
                  <CheckCircle2 size={13} /> Confirm
                </button>
                <button
                  className={`w-decision ${overrides[selected] === "dismissed" ? "active red" : ""}`}
                  data-testid="override-dismiss-button"
                  onClick={() => setOverrides({ ...overrides, [selected]: overrides[selected] === "dismissed" ? undefined : "dismissed" })}
                  data-cursor="hover"
                >
                  <XCircle size={13} /> Dismiss
                </button>
              </div>
            </div>

            <div className="w-section">
              <h3><Sigma size={13} /> Why this signal appears</h3>
              {s.reasons.map((r, i) => (
                <div className="reason" key={i}>
                  <span>{i + 1}</span>
                  <p>{r}</p>
                </div>
              ))}
              {s.style_boundary && (
                <div className="reason boundary">
                  <span>Δ</span>
                  <p>Style boundary Δ = {s.style_boundary.toFixed(2)} — possible hybrid insertion vs. previous sentence.</p>
                </div>
              )}
            </div>

            <div className="w-section">
              <h3><Braces size={13} /> GLTR token ribbon <small>rank bins</small></h3>
              <div className="token-ribbon" data-testid="token-ribbon">
                {s.tokens.slice(0, 80).map((t, i) => (
                  <span
                    key={i}
                    title={`${t.token} · rank ${t.rank} · NLL ${t.log_prob}`}
                    className={`token bin-${t.bin}`}
                    data-cursor="hover"
                  >
                    {t.token}
                  </span>
                ))}
              </div>
              <div className="token-legend">
                <span className="bin-green">1–10</span>
                <span className="bin-yellow">11–100</span>
                <span className="bin-red">101–1k</span>
                <span className="bin-purple">1k+</span>
              </div>
            </div>

            <div className="w-section">
              <h3><Layers size={13} /> Reviewer note</h3>
              <textarea
                data-testid="reviewer-note-input"
                value={notes[selected] || ""}
                onChange={(e) => setNotes({ ...notes, [selected]: e.target.value })}
                placeholder="Add context for the committee…"
              />
            </div>

            <div className="w-actions">
              <button className="btn-primary small" data-testid="save-report-button" onClick={save} data-cursor="hover">
                <Save size={13} /> {saved ? "Saved" : "Save summary"}
              </button>
              {saved && savedReportId && (
                <button className="btn-ghost small" data-testid="dashboard-share-button" onClick={shareSaved} data-cursor="hover">
                  {shareUrl ? <><Copy size={12} /> Link copied</> : <><Share2 size={12} /> Share</>}
                </button>
              )}
              <button className="btn-ghost small" data-testid="export-json-button" onClick={exportJson} data-cursor="hover">
                <Download size={13} /> JSON
              </button>
              <button className="btn-ghost small" data-testid="export-pdf-button" onClick={exportPdf} data-cursor="hover">
                <Download size={13} /> PDF
              </button>
            </div>
            {shareUrl && (
              <div className="share-strip" data-testid="dashboard-share-strip">
                <span>Share link (copied)</span>
                <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
