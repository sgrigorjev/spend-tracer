import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface User {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
}

/** Carries the HTTP status so callers can tell a rejected account from other failures. */
export class AuthError extends Error {
  constructor(readonly status: number) {
    super(`Sign-in failed (${status})`);
    this.name = "AuthError";
  }
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-read the session user, e.g. after the profile settings change. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = (await res.json()) as { user: User };
      setUser(data.user);
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (idToken: string) => {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      throw new AuthError(res.status);
    }
    const data = (await res.json()) as { user: User };
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}
