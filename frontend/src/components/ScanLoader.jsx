/**
 * Scan-line loader for the analysis "reading signals" state. Pure CSS animation
 * (styles in App.css .scan-loader) — no JS timer, respects reduced-motion.
 */
export default function ScanLoader({ label = "Reading signals…" }) {
  return (
    <div className="scan-loader" data-testid="scan-loader" role="status" aria-live="polite">
      <div className="scan-doc">
        <span className="scan-line" />
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`scan-row w${i}`} />
        ))}
      </div>
      <span className="scan-label">{label}</span>
    </div>
  );
}
