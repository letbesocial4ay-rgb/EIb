import { useEffect, useRef, useState } from "react";

/**
 * Animated radial authenticity gauge. Renders as pure SVG with a stroke-dashoffset
 * transition so it stays performant on low-end devices and prints cleanly.
 *
 * value: 0..1
 * ringSize: outer diameter in px
 */
export default function RadialGauge({ value, label = "Authenticity", size = 240 }) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = size / 2 - 18;
  const circumference = 2 * Math.PI * radius;
  const [rendered, setRendered] = useState(0);
  const raf = useRef();

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const from = rendered;
    const to = clamped;
    const duration = 900;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setRendered(from + (to - from) * ease(t));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  // Authenticity meter: higher value = more human. Colors: green (>0.7), amber (0.4–0.7), red (<0.4).
  const tone = rendered >= 0.7 ? "green" : rendered >= 0.4 ? "amber" : "red";
  const gradientId = `gauge-grad-${tone}`;
  const stops =
    tone === "green"
      ? ["#22C55E", "#10B981"]
      : tone === "amber"
      ? ["#F59E0B", "#EAB308"]
      : ["#EF4444", "#F43F5E"];

  const offset = circumference * (1 - rendered);
  const cx = size / 2;

  return (
    <div className="radial-gauge" data-testid="radial-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="100%" stopColor={stops[1]} />
          </linearGradient>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={cx} cy={cx} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12} />
        {/* Value ring */}
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cx})`}
          filter="url(#gauge-glow)"
        />
        {/* Tick marks every 10% */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const inner = radius - 22;
          const outer = radius - 14;
          const x1 = cx + Math.cos(angle) * inner;
          const y1 = cx + Math.sin(angle) * inner;
          const x2 = cx + Math.cos(angle) * outer;
          const y2 = cx + Math.sin(angle) * outer;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.4}
            />
          );
        })}
      </svg>
      <div className="gauge-inner">
        <b className={`gauge-value tone-${tone}`}>{Math.round(rendered * 100)}<small>%</small></b>
        <span className="gauge-label">{label}</span>
      </div>
    </div>
  );
}
