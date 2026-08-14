import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import Logo from "./Logo";
import { API } from "../lib/session";

/**
 * Handles the return trip from Emergent's Google OAuth. The provider redirects to
 * <redirect_url>#session_id=... — we detect the fragment synchronously in AppRouter
 * and mount this component before ProtectedRoute runs.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
 */
export default function AuthCallback({ setSession }) {
  const location = useLocation();
  const nav = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      nav("/login", { replace: true });
      return;
    }
    const sessionId = decodeURIComponent(match[1]);

    (async () => {
      try {
        const r = await axios.post(
          `${API}/auth/google/session`,
          {},
          { headers: { "X-Session-ID": sessionId }, withCredentials: true }
        );
        setSession({ user: r.data.user, token: null, google: true });
        // Clear the fragment before navigating so it never lingers in history.
        window.history.replaceState({}, document.title, "/dashboard");
        nav("/dashboard", { replace: true, state: { user: r.data.user } });
      } catch (x) {
        nav("/login", { replace: true, state: { error: x.response?.data?.detail || "Google sign-in failed" } });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-callback">
      <Logo size={38} />
      <p className="ax-loading-title">Verifying with Google…</p>
      <p className="ax-loading-sub">Setting up your reviewer session.</p>
    </div>
  );
}
