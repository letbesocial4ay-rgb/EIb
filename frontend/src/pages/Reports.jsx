import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Search, Share2, Copy, Check, X } from "lucide-react";
import { API } from "../lib/session";

export default function Reports({ session }) {
  const [items, setItems] = useState([]);
  const [copied, setCopied] = useState(null);
  const [loading, setLoading] = useState(null);

  const load = () => {
    axios
      .get(`${API}/v1/reports`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then((r) => setItems(r.data.reports));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const share = async (id) => {
    setLoading(id);
    try {
      const r = await axios.post(`${API}/v1/reports/${id}/share`, {}, { headers: { Authorization: `Bearer ${session.token}` } });
      const url = `${window.location.origin}${r.data.share_path}`;
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 3000);
      load();
    } catch (x) {
      alert("Couldn't create a share link. Try again.");
    } finally {
      setLoading(null);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm("Revoke the share link? Anyone with the URL will lose access.")) return;
    setLoading(id);
    try {
      await axios.delete(`${API}/v1/reports/${id}/share`, { headers: { Authorization: `Bearer ${session.token}` } });
      load();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="content-page reports">
      <div className="mth-hero compact">
        <div className="eyebrow">Private archive</div>
        <h1>Saved evidence summaries.</h1>
        <p>Only scored output and reviewer notes are stored — never the essay itself. Share a summary for committee review.</p>
      </div>
      <div className="reports-list">
        {items.length ? (
          items.map((r) => (
            <div className="report-row" key={r.id} data-testid="saved-report-row">
              <div className="report-main" data-cursor="hover">
                <b>{r.document_summary.verdict}</b>
                <span>{new Date(r.created_at).toLocaleString()} · {r.document_summary.total_sentences} sentences</span>
                {r.share_token && (
                  <span className="report-share-badge">
                    <Share2 size={11} /> shared · {new Date(r.shared_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="report-score-block">
                <strong>{r.document_summary.overall_score.toFixed(2)}</strong>
              </div>
              <div className="report-actions">
                {r.share_token ? (
                  <>
                    <button
                      className="btn-ghost small"
                      data-testid={`copy-share-${r.id}`}
                      onClick={async () => {
                        const url = `${window.location.origin}/shared/${r.share_token}`;
                        await navigator.clipboard.writeText(url);
                        setCopied(r.id);
                        setTimeout(() => setCopied(null), 2500);
                      }}
                      data-cursor="hover"
                    >
                      {copied === r.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
                    </button>
                    <button
                      className="btn-ghost small danger"
                      data-testid={`revoke-share-${r.id}`}
                      onClick={() => revoke(r.id)}
                      disabled={loading === r.id}
                      data-cursor="hover"
                    >
                      <X size={12} /> Revoke
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-ghost small"
                    data-testid={`share-report-${r.id}`}
                    onClick={() => share(r.id)}
                    disabled={loading === r.id}
                    data-cursor="hover"
                  >
                    {copied === r.id ? <><Check size={12} /> Copied</> : <><Share2 size={12} /> Share to committee</>}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state" data-testid="reports-empty-state">
            <Search size={24} />
            <h2>No saved summaries yet</h2>
            <p>Save an evidence summary from the workspace when you're ready.</p>
            <Link to="/dashboard" className="btn-primary small" data-testid="reports-go-workspace-button" data-cursor="hover">
              Open workspace
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
