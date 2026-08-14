import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { LogOut } from "lucide-react";
import Logo from "./Logo";
import { API } from "../lib/session";

export default function Shell({ children, session, setSession }) {
  const nav = useNavigate();
  const loc = useLocation();
  const isMarketing = loc.pathname === "/" || loc.pathname === "/methodology" || loc.pathname === "/signup" || loc.pathname === "/login" || loc.pathname.startsWith("/shared/");
  return (
    <div className={`ax-shell ${isMarketing ? "shell-dark" : "shell-light"}`} data-testid="app-shell">
      <header className="ax-topbar">
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
        </nav>
      </header>
      <main className="ax-main">{children}</main>
    </div>
  );
}
