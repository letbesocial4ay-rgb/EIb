import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useSession } from "./lib/session";
import Shell from "./components/Shell";
import CustomCursor from "./components/CustomCursor";
import AuthCallback from "./components/AuthCallback";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Methodology from "./pages/Methodology";
import Reports from "./pages/Reports";
import Batch from "./pages/Batch";
import SharedReport from "./pages/SharedReport";
import "./App.css";

function Protected({ session, children }) {
  return session ? children : <Navigate to="/login" replace />;
}

/**
 * Detect the Emergent OAuth callback fragment synchronously during render so
 * AuthCallback owns the session exchange BEFORE the router or Protected wrappers
 * check for a session. Reading useLocation().hash (not window.location.hash) keeps
 * this reactive across history.replaceState in the callback.
 */
function AppRouter({ session, setSession }) {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback setSession={setSession} />;
  }
  return (
    <Shell session={session} setSession={setSession}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Auth mode="signup" setSession={setSession} />} />
        <Route path="/login" element={<Auth mode="login" setSession={setSession} />} />
        <Route path="/methodology" element={<Methodology />} />
        <Route path="/shared/:token" element={<SharedReport />} />
        <Route path="/dashboard" element={<Protected session={session}><Dashboard session={session} /></Protected>} />
        <Route path="/batch" element={<Protected session={session}><Batch session={session} /></Protected>} />
        <Route path="/reports" element={<Protected session={session}><Reports session={session} /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  const [session, setSession] = useSession();
  return (
    <BrowserRouter>
      <CustomCursor />
      <AppRouter session={session} setSession={setSession} />
    </BrowserRouter>
  );
}
