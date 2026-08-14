import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { FileUp, ArrowRight, X, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { API } from "../lib/session";

const COLUMNS = [
  { key: "overall_score", label: "Score", format: (v) => v.toFixed(2) },
  { key: "verdict", label: "Verdict", format: (v) => v },
  { key: "mean_sentence_perplexity", label: "PPL", format: (v) => v.toFixed(1) },
  { key: "burstiness_index", label: "Burst", format: (v) => v.toFixed(2) },
  { key: "esl_confidence_score", label: "ESL", format: (v) => v.toFixed(2) },
  { key: "flagged_sentence_count", label: "Flags", format: (v) => v },
  { key: "hybrid_boundary_count", label: "Hybrid Δ", format: (v) => v ?? 0 },
];

function risk(score) {
  return score >= 0.62 ? "red" : score >= 0.42 ? "amber" : "green";
}

export default function Batch({ session }) {
  const [items, setItems] = useState([]); // { filename, status, summary?, error? }
  const [sortKey, setSortKey] = useState("overall_score");
  const [sortDir, setSortDir] = useState("desc");

  const analyzeOne = async (file, idx) => {
    try {
      // Ingest.
      const fd = new FormData();
      fd.append("file", file);
      const ingest = await axios.post(`${API}/v1/ingest`, fd, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status: "analyzing", word_count: ingest.data.word_count } : it)));
      // Analyze.
      const r = await axios.post(
        `${API}/v1/analyze`,
        { text: ingest.data.text, options: { include_token_details: false, esl_sensitivity_dampener: true } },
        { headers: { Authorization: `Bearer ${session.token}` } }
      );
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status: "done", summary: r.data.document_summary } : it)));
    } catch (x) {
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status: "error", error: x.response?.data?.detail || "Failed to analyze" } : it)));
    }
  };

  const onDrop = useCallback(
    (accepted) => {
      if (!accepted.length) return;
      const start = items.length;
      const additions = accepted.map((f) => ({ filename: f.name, status: "queued" }));
      setItems((prev) => [...prev, ...additions]);
      accepted.forEach((f, i) => analyzeOne(f, start + i));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length, session]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  });

  const sorted = [...items].sort((a, b) => {
    if (!a.summary || !b.summary) return a.summary ? -1 : 1;
    const av = a.summary[sortKey];
    const bv = b.summary[sortKey];
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? (av ?? 0) - (bv ?? 0) : (bv ?? 0) - (av ?? 0);
  });

  const remove = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const clear = () => setItems([]);

  const doneCount = items.filter((i) => i.status === "done").length;
  const meanScore = doneCount ? items.filter((i) => i.summary).reduce((s, i) => s + i.summary.overall_score, 0) / doneCount : 0;

  return (
    <div className="workspace batch-page" data-testid="batch-root">
      <div className="workspace-head">
        <div>
          <div className="eyebrow">Batch review</div>
          <h1>Compare essays side by side</h1>
          <p>Drop up to twenty essays. Each is scored with the same deterministic pipeline; sort the table to spot outliers.</p>
        </div>
        {doneCount > 0 && (
          <div className="score-lockup" data-testid="batch-mean">
            <span>Batch mean</span>
            <strong className={`tone-${risk(meanScore)}`}>{meanScore.toFixed(2)}</strong>
            <small>{doneCount} essays</small>
          </div>
        )}
      </div>

      <div
        {...getRootProps({ className: `batch-drop ${isDragActive ? "active" : ""}` })}
        data-testid="batch-dropzone"
        data-cursor="hover"
      >
        <input {...getInputProps()} data-testid="batch-dropzone-input" />
        <FileUp size={20} />
        <div>
          <p className="dz-title">Drop essays here</p>
          <p className="dz-sub">TXT · DOCX · PDF. Files are parsed in memory and never persisted.</p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="batch-table-wrap">
          <div className="batch-controls">
            <span>{doneCount} of {items.length} analyzed</span>
            <button className="btn-ghost small" onClick={clear} data-testid="batch-clear-button" data-cursor="hover">
              Clear all
            </button>
          </div>
          <table className="batch-table" data-testid="batch-table">
            <thead>
              <tr>
                <th>Essay</th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`sortable ${sortKey === c.key ? `sorted-${sortDir}` : ""}`}
                    onClick={() => {
                      if (sortKey === c.key) setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else { setSortKey(c.key); setSortDir("desc"); }
                    }}
                    data-testid={`batch-col-${c.key}`}
                    data-cursor="hover"
                  >
                    {c.label}
                    {sortKey === c.key && (sortDir === "asc" ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((it, i) => {
                const origIdx = items.indexOf(it);
                return (
                  <tr key={origIdx} data-testid={`batch-row-${origIdx}`}>
                    <td className="fname">
                      <b>{it.filename}</b>
                      {it.word_count && <span> · {it.word_count} words</span>}
                      {it.status === "queued" && <em> queued…</em>}
                      {it.status === "analyzing" && <em><Loader2 size={11} className="spin" /> analyzing…</em>}
                      {it.status === "error" && <em className="err">error: {it.error}</em>}
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className={c.key === "overall_score" && it.summary ? `tone-${risk(it.summary.overall_score)}` : ""}>
                        {it.summary ? c.format(it.summary[c.key]) : "—"}
                      </td>
                    ))}
                    <td>
                      <button className="row-remove" onClick={() => remove(origIdx)} aria-label="Remove" data-testid={`batch-remove-${origIdx}`} data-cursor="hover">
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="batch-empty">
          <p>No essays yet. Drop files above, or <Link to="/dashboard" data-cursor="hover">analyze one at a time</Link>.</p>
        </div>
      )}
    </div>
  );
}
