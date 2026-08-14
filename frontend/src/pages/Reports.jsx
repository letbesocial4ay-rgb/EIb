import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Search } from "lucide-react";
import { API } from "../lib/session";

export default function Reports({ session }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    axios
      .get(`${API}/v1/reports`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then((r) => setItems(r.data.reports));
  }, [session]);

  return (
    <div className="content-page reports">
      <div className="mth-hero compact">
        <div className="eyebrow">Private archive</div>
        <h1>Saved evidence summaries.</h1>
        <p>Only scored output and reviewer notes are stored — never the essay itself.</p>
      </div>
      <div className="reports-list">
        {items.length ? (
          items.map((r) => (
            <div className="report-row" key={r.id} data-testid="saved-report-row" data-cursor="hover">
              <div>
                <b>{r.document_summary.verdict}</b>
                <span>{new Date(r.created_at).toLocaleString()} · {r.document_summary.total_sentences} sentences</span>
              </div>
              <strong>{r.document_summary.overall_score.toFixed(2)}</strong>
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
