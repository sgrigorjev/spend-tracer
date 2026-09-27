import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Login } from "./Login";
import { Dashboard } from "./Dashboard";
import { Settings } from "./Settings";
import { AppShell } from "./AppShell";

/** Gate for the authenticated routes: no session sends the visitor to /login. */
function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell />;
}

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Loading…</p>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
