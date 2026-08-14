import { useEffect, useRef, useState } from "react";

/**
 * A two-part cursor: a small dot that tracks pointer position exactly, and a
 * larger ring that lags slightly and expands when hovering interactive elements.
 * mix-blend-mode: difference lets it invert against any background.
 */
export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip on touch devices — no cursor to enhance.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let frame;

    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) setVisible(true);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mx - 4}px, ${my - 4}px, 0)`;
      }
      const el = e.target;
      const interactive = el?.closest?.("a, button, [role=button], input, textarea, label, [data-cursor='hover']");
      setHovering(!!interactive);
    };

    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${rx - 18}px, ${ry - 18}px, 0)`;
      }
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove);
    frame = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [visible]);

  return (
    <>
      <div
        ref={dotRef}
        className={`ax-cursor-dot ${visible ? "on" : ""}`}
        aria-hidden="true"
      />
      <div
        ref={ringRef}
        className={`ax-cursor-ring ${visible ? "on" : ""} ${hovering ? "hover" : ""}`}
        aria-hidden="true"
      />
    </>
  );
}
