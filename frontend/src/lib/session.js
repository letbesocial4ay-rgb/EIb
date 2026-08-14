import { useEffect, useState } from "react";
import axios from "axios";

const KEY = "araxyss.session.v1";
export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Axios defaults: always send cookies so the Google session_token flows on same-origin
// calls; when we have a JWT (email/password login) we still attach the Authorization header.
axios.defaults.withCredentials = true;

export function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch (e) {
    return null;
  }
}

export function useSession() {
  const [session, setSessionState] = useState(() => readSession());
  const [checked, setChecked] = useState(false);

  const write = (s) => {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
    setSessionState(s);
  };

  // On mount, verify with the server so Google-cookie sessions are picked up even if
  // sessionStorage is empty (fresh tab after OAuth). Skip if the URL hash contains
  // session_id — AuthCallback owns that flow and will call setSession itself.
  useEffect(() => {
    if (checked) return;
    if (window.location.hash?.includes("session_id=")) { setChecked(true); return; }
    if (session) { setChecked(true); return; }
    (async () => {
      try {
        const r = await axios.get(`${API}/auth/me`, { withCredentials: true });
        write({ user: r.data.user, token: null, google: r.data.auth_via?.startsWith("google") });
      } catch (e) {
        // No session — remain logged out silently.
      } finally {
        setChecked(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [session, write];
}
