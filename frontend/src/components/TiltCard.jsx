import { useRef } from "react";

/**
 * Glass card with a 3D tilt-on-hover effect. Uses transform: perspective + rotateX/rotateY
 * driven by pointer position over the card. Pointer leaves → tilt eases back to zero.
 */
export default function TiltCard({ children, className = "", intensity = 8, ...rest }) {
  const ref = useRef(null);

  const onMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.setProperty("--tilt-x", `${-y * intensity}deg`);
    ref.current.style.setProperty("--tilt-y", `${x * intensity}deg`);
    ref.current.style.setProperty("--gloss-x", `${(x + 0.5) * 100}%`);
    ref.current.style.setProperty("--gloss-y", `${(y + 0.5) * 100}%`);
  };

  const onLeave = () => {
    if (!ref.current) return;
    ref.current.style.setProperty("--tilt-x", "0deg");
    ref.current.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      data-cursor="hover"
      {...rest}
    >
      <div className="tilt-card-inner">
        <span className="tilt-gloss" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
