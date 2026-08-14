import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Logo from "../components/Logo";
import { API } from "../lib/session";

// Simple Google mark rendered inline to avoid an extra dependency.
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Auth({ mode, setSession }) {
  const nav = useNavigate();
  const signup = mode === "signup";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await axios.post(`${API}/auth/${signup ? "signup" : "login"}`, form);
      setSession({ ...r.data, google: false });
      nav("/dashboard");
    } catch (x) {
      setError(x.response?.data?.detail || "Could not complete this request");
    } finally {
      setBusy(false);
    }
  };

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="auth-page">
      <div className="auth-left" aria-hidden="true">
        <div className="auth-brand">
          <Logo size={28} showWord />
        </div>
        <div className="auth-copy">
          <div className="eyebrow">Reviewer access</div>
          <h1>{signup ? "A more defensible read." : "Welcome back."}</h1>
          <p>Accounts store identity only. Essay content never touches the database.</p>
        </div>
        <div className="auth-figure">
          <div className="auth-orbit">
            <span className="orbit-dot green" />
            <span className="orbit-dot amber" />
            <span className="orbit-dot red" />
            <span className="orbit-dot purple" />
          </div>
        </div>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <div className="form-heading">
          <span>{signup ? "New account" : "Sign in"}</span>
          <Link to={signup ? "/login" : "/signup"} data-testid="auth-switch-link" data-cursor="hover">
            {signup ? "Have an account? Sign in" : "Need an account? Sign up"}
          </Link>
        </div>

        <button
          type="button"
          className="btn-google"
          onClick={google}
          data-testid="google-signin-button"
          data-cursor="hover"
        >
          <GoogleMark />
          <span>Continue with Google</span>
        </button>

        <div className="auth-divider"><span>or with email</span></div>

        {signup && (
          <label>
            Name
            <input
              data-testid="signup-name-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            data-testid={`${signup ? "signup" : "login"}-email-input`}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            data-testid={`${signup ? "signup" : "login"}-password-input`}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </label>

        {error && (
          <div className="error-box" data-testid="auth-error">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <button
          className="btn-primary full"
          data-testid={`${signup ? "signup" : "login"}-submit-button`}
          disabled={busy}
          data-cursor="hover"
        >
          {busy ? "Signing in…" : signup ? "Create account" : "Enter workspace"}
          <ArrowRight size={16} />
        </button>
        <p className="form-note">
          By continuing you agree that only anonymous scored output (never raw essay text) may
          be saved to your reports archive.
        </p>
      </form>
    </div>
  );
}
