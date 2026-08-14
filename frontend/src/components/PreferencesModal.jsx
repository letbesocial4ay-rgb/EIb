import { useEffect, useState } from "react";
import { X, Sparkles, Moon, Sun, Settings } from "lucide-react";
import { usePreferences } from "../lib/preferences";

export default function PreferencesModal({ open, onClose, session }) {
  const [prefs, update] = usePreferences();
  const [rmActual, setRmActual] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cb = () => setRmActual(m.matches);
    cb();
    m.addEventListener?.("change", cb);
    return () => m.removeEventListener?.("change", cb);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const rmEffective = prefs.reducedMotion || rmActual;

  return (
    <div className="ax-modal-shroud" onClick={onClose} data-testid="preferences-modal">
      <div className="ax-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="prefs-title">
        <div className="ax-modal-head">
          <div>
            <div className="eyebrow"><Settings size={12} /> Preferences</div>
            <h2 id="prefs-title">Make the room work for you</h2>
          </div>
          <button className="ax-modal-close" onClick={onClose} aria-label="Close" data-testid="preferences-close" data-cursor="hover">
            <X size={16} />
          </button>
        </div>

        <div className="pref-row">
          <div className="pref-copy">
            <b><Sparkles size={13} /> Reduce animations</b>
            <small>
              Silence the 3D scene, gradient shifts, count-ups and hover tilts across the app.
              {rmActual && <span> Your OS-level reduce-motion setting is currently active.</span>}
            </small>
          </div>
          <button
            className={`w-switch big ${rmEffective ? "on" : ""}`}
            aria-pressed={rmEffective}
            onClick={() => update({ reducedMotion: !prefs.reducedMotion })}
            data-testid="pref-reduced-motion"
            data-cursor="hover"
          >
            <span />
          </button>
        </div>

        <div className="pref-row">
          <div className="pref-copy">
            <b>{prefs.workspaceDark ? <Moon size={13} /> : <Sun size={13} />} Dark workspace</b>
            <small>Switch the dashboard, reports and batch pages to a low-glare palette that matches the landing.</small>
          </div>
          <button
            className={`w-switch big ${prefs.workspaceDark ? "on" : ""}`}
            aria-pressed={prefs.workspaceDark}
            onClick={() => update({ workspaceDark: !prefs.workspaceDark })}
            data-testid="pref-workspace-dark"
            data-cursor="hover"
          >
            <span />
          </button>
        </div>

        <div className="ax-modal-foot">
          {session ? (
            <span>Signed in as <b>{session.user?.name || session.user?.email}</b></span>
          ) : (
            <span>Preferences are stored locally on this device.</span>
          )}
          <button className="btn-ghost small" onClick={onClose} data-testid="preferences-done" data-cursor="hover">Done</button>
        </div>
      </div>
    </div>
  );
}
