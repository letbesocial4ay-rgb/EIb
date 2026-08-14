import { useEffect, useRef, useState } from "react";

/**
 * Count-up number animation. Kicks off when the element scrolls into view.
 * Uses IntersectionObserver + rAF interpolation so it never runs off-screen.
 */
export default function CountUp({ to, prefix = "", suffix = "", decimals = 0, duration = 1600 }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const played = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !played.current) {
            played.current = true;
            const start = performance.now();
            const ease = (t) => 1 - Math.pow(1 - t, 3);
            const step = (now) => {
              const t = Math.min(1, (now - start) / duration);
              setN(to * ease(t));
              if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }
        });
      },
      { threshold: 0.5 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [to, duration]);

  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className="count-up">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
