import { useEffect, useState } from "react";
import { useAuth, type User } from "./auth";

interface DashboardData {
  user: User;
  totalExpenses: number | null;
}

export function Dashboard() {
  const { logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Dashboard unavailable");
        }
        return res.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <main>
      <h1>Dashboard</h1>
      {data ? (
        <>
          <p>Signed in as {data.user.email}</p>
          <p>Total expenses: {data.totalExpenses === null ? "not available yet" : data.totalExpenses}</p>
        </>
      ) : (
        <p>Loading dashboard…</p>
      )}
      <button onClick={() => void logout()}>Sign out</button>
    </main>
  );
}
