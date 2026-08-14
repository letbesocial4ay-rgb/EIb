import React from "react";

// Araxyss glyph: monospace "A" flanked by [ and ], with a rank-bin bar underneath.
// currentColor drives the fill so the mark inherits from the surrounding text.
export default function Logo({ size = 32, showWord = false, className = "" }) {
  return (
    <span className={`araxyss-logo ${className}`} data-testid="araxyss-logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Araxyss"
        role="img"
      >
        {/* Left bracket */}
        <path d="M18 12 h14 v6 H24 v64 h8 v6 H18 z" fill="currentColor" />
        {/* Right bracket */}
        <path d="M82 12 h-14 v6 h8 v64 h-8 v6 h14 z" fill="currentColor" />
        {/* A stroke */}
        <path
          d="M50 20 L30 82 h9.5 L45 66 h10 l5.5 16 H70 L50 20 z M47.5 58 L50 42 l2.5 16 z"
          fill="currentColor"
        />
        {/* Rank-bin under the A: green | yellow | red | purple hint */}
        <g>
          <rect x="34" y="86" width="7" height="4" fill="#22C55E" />
          <rect x="42" y="86" width="7" height="4" fill="#EAB308" />
          <rect x="50" y="86" width="7" height="4" fill="#EF4444" />
          <rect x="58" y="86" width="7" height="4" fill="#A855F7" />
        </g>
      </svg>
      {showWord && <span className="araxyss-wordmark">Araxyss</span>}
    </span>
  );
}
