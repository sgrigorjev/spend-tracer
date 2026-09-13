import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";

/** Resolve the Google accounts API, waiting up to `timeoutMs` for the script to load. */
function waitForAccounts(timeoutMs = 10000) {
  return new Promise<NonNullable<Window["google"]>["accounts"]["id"]>((resolve, reject) => {
    const existing = window.google?.accounts.id;
    if (existing) {
      resolve(existing);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      const accounts = window.google?.accounts.id;
      if (accounts) {
        clearInterval(timer);
        resolve(accounts);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Google sign-in script did not load"));
      }
    }, 100);
  });
}

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
        const accounts = await waitForAccounts();
        if (!buttonRef.current) {
          throw new Error("Button container missing");
        }
        accounts.initialize({
          client_id: googleClientId,
          callback: (response) => {
            void login(response.credential).catch((err: Error) => setError(err.message));
          },
        });
        accounts.renderButton(buttonRef.current, { theme: "outline", size: "large" });
        if (!cancelled) {
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Google sign-in");
        }
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
