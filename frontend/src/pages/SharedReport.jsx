import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import Logo from "../components/Logo";
import { API } from "../lib/session";

function risk(score) {
  return score >= 0.62 ? "red" : score >= 0.42 ? "amber" : "green";
}

export default function SharedReport() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`${API}/v1/shared/${token}`)
      .then((r) => setReport(r.data))
      .catch((x) => setError(x.response?.data?.detail || "That share link is no longer active."));
  }, [token]);

  if (error) {
    return (
      <div className="content-page shared-report">
        <div className="mth-hero compact">
          <div className="eyebrow"><AlertTriangle size={13} /> Share link inactive</div>
          <h1>This link isn't available.</h1>
          <p>The reviewer may have revoked it, or the URL is incomplete.</p>
          <Link to="/" className="btn-ghost" style={{ marginTop: 30, display: "inline-flex" }} data-cursor="hover">
            Back to araxyss.
          </Link>
        </div>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="content-page shared-report">
        <div className="mth-hero compact">
          <div className="eyebrow">Loading…</div>
          <h1>Fetching the dossier.</h1>
        </div>
      </div>
    );
  }

  const s = report.document_summary;
  const overrides = report.reviewer_overrides || {};
  const notes = report.reviewer_notes || {};
  const confirmed = Object.values(overrides).filter((v) => v === "confirmed").length;
  const dismissed = Object.values(overrides).filter((v) => v === "dismissed").length;

  return (
    <div className="content-page shared-report" data-testid="shared-report">
      <div className="shared-head">
        <div className="eyebrow"><ShieldCheck size={13} /> Public evidence dossier · read-only</div>
        <div className="shared-verdict">
          <div>
            <h1 className={`tone-${risk(s.overall_score)}`}>{s.overall_score.toFixed(2)}</h1>
            <p className="verdict-label">{s.verdict}</p>
          </div>
          <div className="shared-brand">
            <Logo size={22} showWord />
            <p className="foot-tag">Shared on {new Date(report.shared_at || report.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="shared-signal-row">
          <span><b>{s.total_sentences}</b> sentences</span>
          <span><b>{s.flagged_sentence_count}</b> flagged</span>
          <span><b>{s.mean_sentence_perplexity.toFixed(1)}</b> mean PPL</span>
          <span><b>{s.burstiness_index.toFixed(2)}</b> burstiness</span>
          <span><b>{s.esl_confidence_score.toFixed(2)}</b> ESL score</span>
          <span><b>{confirmed}</b> ✓ · <b>{dismissed}</b> ✕ reviewer decisions</span>
        </div>
      </div>

      <div className="shared-body">
        <div className="shared-note">
          <ShieldCheck size={13} />
          <span>Essay text is <b>not</b> included in shared dossiers. Only scored output, reviewer notes and overrides.</span>
        </div>

        <div className="shared-list" data-testid="shared-sentence-list">
          {report.sentences.map((row, i) => {
            const override = overrides[i] || overrides[String(i)];
            const note = notes[i] || notes[String(i)];
            return (
              <div key={row.sentence_id} className={`shared-row tone-${risk(row.score)}`} data-testid={`shared-sentence-${i}`}>
                <div className="shared-row-head">
                  <span className="ix">{String(i + 1).padStart(2, "0")}</span>
                  <b className={`tone-${risk(row.score)}`}>{row.score.toFixed(2)}</b>
                  <span className="cls">{row.classification.replaceAll("_", " ")}</span>
                  {override === "confirmed" && <span className="chip green"><CheckCircle2 size={11} /> confirmed</span>}
                  {override === "dismissed" && <span className="chip red"><XCircle size={11} /> dismissed</span>}
                </div>
                <div className="shared-row-signals">
                  <span>ppl <b>{row.perplexity}</b></span>
                  <span>top-10 <b>{Math.round(row.top10_ratio * 100)}%</b></span>
                  <span>depth <b>{row.syntactic_depth}</b></span>
                  {row.esl_score !== undefined && <span>ESL <b>{row.esl_score.toFixed(2)}</b></span>}
                </div>
                {row.reasons && row.reasons.length > 0 && (
                  <ul className="shared-row-reasons">
                    {row.reasons.slice(0, 3).map((r, j) => <li key={j}>{r}</li>)}
                  </ul>
                )}
                {note && <div className="shared-note-block">Reviewer note: <i>"{note}"</i></div>}
              </div>
            );
          })}
        </div>

        <div className="shared-footer">
          <span>Engine: {s.engine.model_checkpoint} · {s.engine.device} · rule {s.engine.rule_version}</span>
          <Link to="/" className="link-arrow" data-cursor="hover">Learn how araxyss works →</Link>
        </div>
      </div>
    </div>
  );
}
