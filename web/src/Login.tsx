import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";

export function Login() {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch("/api/auth/config");
        if (!res.ok) {
          throw new Error("Config unavailable");
        }
        const { googleClientId } = (await res.json()) as { googleClientId: string };
        const google = window.google;
        if (!google || !buttonRef.current) {
          throw new Error("Google sign-in script did not load");
        }
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            void login(response.credential).catch((err: Error) => setError(err.message));
          },
        });
        google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large" });
        if (!cancelled) {
          setReady(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Google sign-in");
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [login]);

  return (
    <main>
      <h1>Spend Tracer</h1>
      {error && <p role="alert">{error}</p>}
      <div ref={buttonRef} style={{ visibility: ready ? "visible" : "hidden" }} />
    </main>
  );
}
