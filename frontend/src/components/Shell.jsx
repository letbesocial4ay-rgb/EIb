import { useEffect, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { LogOut, Settings } from "lucide-react";
import Logo from "./Logo";
import { API } from "../lib/session";
import PreferencesModal from "./PreferencesModal";
import { applyToDocument } from "../lib/preferences";

export default function Shell({ children, session, setSession }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [condensed, setCondensed] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  useEffect(() => { applyToDocument(); }, []);
  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const isMarketing = loc.pathname === "/" || loc.pathname === "/methodology" || loc.pathname === "/signup" || loc.pathname === "/login" || loc.pathname.startsWith("/shared/");
  return (
    <div className={`ax-shell ${isMarketing ? "shell-dark" : "shell-light"}`} data-testid="app-shell">
      <header className={`ax-topbar ${condensed ? "condensed" : ""}`}>
        <Link to="/" className="ax-brand" data-testid="brand-home" data-cursor="hover">
          <Logo size={26} />
          <span className="brandword">
            Araxyss
            <small>Essay Auditor</small>
          </span>
        </Link>
        <nav className="ax-nav">
          <NavLink to="/methodology" className={({ isActive }) => (isActive ? "active" : "")} data-testid="nav-methodology" data-cursor="hover">
            Methodology
          </NavLink>
          {session ? (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")} data-testid="nav-dashboard" data-cursor="hover">
                Workspace
              </NavLink>
              <NavLink to="/batch" className={({ isActive }) => (isActive ? "active" : "")} data-testid="nav-batch" data-cursor="hover">
                Batch
              </NavLink>
              <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")} data-testid="nav-reports" data-cursor="hover">
                Reports
              </NavLink>
              <button
                className="ax-logout"
                data-testid="logout-button"
                onClick={async () => {
                  try {
                    await axios.post(`${API}/auth/logout`, {}, {
                      headers: session.token ? { Authorization: `Bearer ${session.token}` } : {},
                      withCredentials: true,
                    });
                  } catch (e) {}
                  setSession(null);
                  nav("/");
                }}
                data-cursor="hover"
              >
                <LogOut size={13} /> {session.user?.name?.split(" ")[0] || "Log out"}
              </button>
            </>
          ) : (
            <Link to="/signup" className="ax-nav-cta" data-testid="nav-signup" data-cursor="hover">
              Get access
            </Link>
          )}
          <button
            className="ax-icon-btn"
            onClick={() => setPrefsOpen(true)}
            aria-label="Preferences"
            data-testid="open-preferences-button"
            data-cursor="hover"
          >
            <Settings size={14} />
          </button>
        </nav>
      </header>
      <main className="ax-main">{children}</main>
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} session={session} />
    </div>
  );
}
