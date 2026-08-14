import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./lib/session";
import Shell from "./components/Shell";
import CustomCursor from "./components/CustomCursor";
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

export default function App() {
  const [session, setSession] = useSession();
  return (
    <BrowserRouter>
      <CustomCursor />
      <Shell session={session} setSession={setSession}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Auth mode="signup" setSession={setSession} />} />
          <Route path="/login" element={<Auth mode="login" setSession={setSession} />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/shared/:token" element={<SharedReport />} />
          <Route
            path="/dashboard"
            element={<Protected session={session}><Dashboard session={session} /></Protected>}
          />
          <Route
            path="/batch"
            element={<Protected session={session}><Batch session={session} /></Protected>}
          />
          <Route
            path="/reports"
            element={<Protected session={session}><Reports session={session} /></Protected>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
