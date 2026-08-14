import { useEffect, useState, useCallback } from "react";

const PREF_KEY = "araxyss.prefs.v1";
const DEFAULTS = { reducedMotion: false, workspaceDark: false };

let listeners = [];
let cached = null;

function read() {
  if (cached) return cached;
  try {
    const parsed = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
    cached = { ...DEFAULTS, ...(parsed || {}) };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}

function write(next) {
  cached = { ...cached, ...next };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(cached)); } catch {}
  listeners.forEach((cb) => cb(cached));
  applyToDocument(cached);
}

export function applyToDocument(prefs = read()) {
  const html = document.documentElement;
  const reduce = prefs.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  html.setAttribute("data-reduced-motion", reduce ? "true" : "false");
  html.setAttribute("data-workspace-theme", prefs.workspaceDark ? "dark" : "light");
}

export function usePreferences() {
  const [prefs, setPrefs] = useState(read);
  useEffect(() => {
    const cb = (next) => setPrefs({ ...next });
    listeners.push(cb);
    applyToDocument();
    return () => { listeners = listeners.filter((l) => l !== cb); };
  }, []);
  const update = useCallback((patch) => write(patch), []);
  return [prefs, update];
}
