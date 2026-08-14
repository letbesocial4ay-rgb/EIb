import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Logo from "../components/Logo";
import { API } from "../lib/session";

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
      setSession(r.data);
      nav("/dashboard");
    } catch (x) {
      setError(x.response?.data?.detail || "Could not complete this request");
    } finally {
      setBusy(false);
    }
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
