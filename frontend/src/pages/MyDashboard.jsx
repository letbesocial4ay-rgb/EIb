import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Home, FileText, Share2, Pin, PinOff, TrendingUp, Clock, ArrowRight, Trash2,
  BookOpen, LayoutGrid, PlusCircle, ShieldCheck,
} from "lucide-react";
import { API } from "../lib/session";

function risk(score) { return score >= 0.62 ? "red" : score >= 0.42 ? "amber" : "green"; }
function timeAgo(iso) {
  const t = new Date(iso).getTime();
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default function MyDashboard({ session }) {
  const [summary, setSummary] = useState({ total_reports: 0, shared_count: 0, pinned_count: 0, avg_score: 0, avg_authenticity: 0 });
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState({});

  const load = async () => {
    const [s, r] = await Promise.all([
      axios.get(`${API}/v1/home/summary`, { headers: { Authorization: `Bearer ${session.token || ""}` }, withCredentials: true }),
      axios.get(`${API}/v1/reports`, { headers: { Authorization: `Bearer ${session.token || ""}` }, withCredentials: true }),
    ]);
    setSummary(s.data);
    setReports(r.data.reports);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const togglePin = async (id, next) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await axios.patch(`${API}/v1/reports/${id}`, { pinned: next }, { headers: { Authorization: `Bearer ${session.token || ""}` }, withCredentials: true });
      await load();
    } finally { setBusy((b) => ({ ...b, [id]: false })); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this saved summary permanently?")) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await axios.delete(`${API}/v1/reports/${id}`, { headers: { Authorization: `Bearer ${session.token || ""}` }, withCredentials: true });
      await load();
    } finally { setBusy((b) => ({ ...b, [id]: false })); }
  };

  const pinned = reports.filter((r) => r.pinned);
  const recent = reports.filter((r) => !r.pinned).slice(0, 8);

  return (
    <div className="workspace my-home" data-testid="my-home-root">
      <div className="workspace-head">
        <div>
          <div className="eyebrow"><Home size={12} /> Your control room</div>
          <h1>Welcome back, {(session.user?.name || "reviewer").split(" ")[0]}.</h1>
          <p>Every saved summary, share link, and pinned dossier lives here — never the raw essays.</p>
        </div>
        <div className="home-quick-actions">
          <Link to="/dashboard" className="btn-primary small" data-testid="home-new-analysis" data-cursor="hover"><PlusCircle size={13} /> New analysis</Link>
          <Link to="/batch" className="btn-ghost small" data-testid="home-batch" data-cursor="hover"><LayoutGrid size={13} /> Batch</Link>
        </div>
      </div>

      <div className="home-stats" data-testid="home-stats">
        <div className="home-stat">
          <FileText size={14} />
          <b>{summary.total_reports}</b>
          <span>Saved summaries</span>
        </div>
        <div className="home-stat">
          <TrendingUp size={14} />
          <b className={`tone-${risk(summary.avg_score)}`}>{(summary.avg_authenticity * 100).toFixed(0)}%</b>
          <span>Avg. authenticity across your dossiers</span>
        </div>
        <div className="home-stat">
          <Share2 size={14} />
          <b>{summary.shared_count}</b>
          <span>Shared with committee</span>
        </div>
        <div className="home-stat">
          <Pin size={14} />
          <b>{summary.pinned_count}</b>
          <span>Pinned dossiers</span>
        </div>
      </div>

      <section className="home-section">
        <div className="home-section-head">
          <h2><Pin size={16} /> Pinned</h2>
          <span>Keep your ongoing committee cases close</span>
        </div>
        {pinned.length ? (
          <div className="home-grid">
            {pinned.map((r) => (
              <div className="home-report-card pinned" key={r.id} data-testid={`pinned-report-${r.id}`}>
                <div className="report-card-head">
                  <b className={`tone-${risk(r.document_summary.overall_score)}`}>{r.document_summary.overall_score.toFixed(2)}</b>
                  <button className="pin-btn active" data-testid={`unpin-${r.id}`} onClick={() => togglePin(r.id, false)} disabled={busy[r.id]} aria-label="Unpin" data-cursor="hover">
                    <PinOff size={13} />
                  </button>
                </div>
                <p className="report-card-verdict">{r.document_summary.verdict}</p>
                <div className="report-card-meta">
                  <span><Clock size={11} /> {timeAgo(r.created_at)}</span>
                  <span>{r.document_summary.total_sentences} sentences</span>
                  {r.share_token && <span className="chip"><Share2 size={11} /> shared</span>}
                </div>
                {r.reviewer_notes && Object.values(r.reviewer_notes).filter(Boolean).length > 0 && (
                  <p className="report-card-note">"{Object.values(r.reviewer_notes).filter(Boolean)[0]}"</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="home-empty" data-testid="home-empty-pinned">
            Nothing pinned yet. From the workspace, save a dossier and click the pin to keep it here.
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <h2><Clock size={16} /> Recent activity</h2>
          <span>Your last saved dossiers</span>
        </div>
        {recent.length ? (
          <div className="home-activity">
            {recent.map((r) => (
              <div className="activity-row" key={r.id} data-testid={`activity-${r.id}`}>
                <div className="activity-icon">
                  <BookOpen size={13} />
                </div>
                <div className="activity-main">
                  <b>{r.document_summary.verdict}</b>
                  <span>{r.document_summary.total_sentences} sentences · {r.document_summary.flagged_sentence_count} flagged</span>
                </div>
                <div className={`activity-score tone-${risk(r.document_summary.overall_score)}`}>
                  {r.document_summary.overall_score.toFixed(2)}
                </div>
                <div className="activity-time">{timeAgo(r.created_at)}</div>
                <div className="activity-actions">
                  <button className="pin-btn" data-testid={`pin-${r.id}`} onClick={() => togglePin(r.id, true)} disabled={busy[r.id]} aria-label="Pin" data-cursor="hover">
                    <Pin size={13} />
                  </button>
                  {r.share_token && (
                    <Link className="pin-btn" to={`/shared/${r.share_token}`} target="_blank" rel="noreferrer" aria-label="Open shared" data-cursor="hover">
                      <Share2 size={13} />
                    </Link>
                  )}
                  <button className="pin-btn danger" data-testid={`delete-${r.id}`} onClick={() => remove(r.id)} disabled={busy[r.id]} aria-label="Delete" data-cursor="hover">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            {reports.length > 8 && (
              <Link to="/reports" className="activity-more" data-cursor="hover">
                See all {reports.length} saved summaries <ArrowRight size={12} />
              </Link>
            )}
          </div>
        ) : (
          <div className="home-empty" data-testid="home-empty-recent">
            No saved summaries yet. Start by <Link to="/dashboard" data-cursor="hover">analyzing an essay</Link>.
          </div>
        )}
      </section>

      <section className="home-section privacy-note">
        <ShieldCheck size={13} />
        <span>Only scored output and reviewer notes are saved. Essay text never touches disk.</span>
      </section>
    </div>
  );
}
