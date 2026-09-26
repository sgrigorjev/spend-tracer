import { useEffect, useRef, useState } from "react";
import { CircleAlert, Lock, Moon, Sun, Wallet } from "lucide-react";
import { AuthError, useAuth } from "./auth";
import { useTheme } from "./theme";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "./components/ui/card";

const ALLOWLIST_MESSAGE = "This account is not on the allowlist.";
const GENERIC_MESSAGE = "Sign-in failed. Please try again.";

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
  const { theme, toggleTheme } = useTheme();
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
            void login(response.credential).catch((err: unknown) => {
              if (cancelled) {
                return;
              }
              setError(
                err instanceof AuthError && err.status === 403
                  ? ALLOWLIST_MESSAGE
                  : GENERIC_MESSAGE,
              );
            });
          },
        });
        const width = Math.min(400, Math.max(200, buttonRef.current.clientWidth));
        accounts.renderButton(buttonRef.current, { theme: "outline", size: "large", width });
        if (!cancelled) {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setError(GENERIC_MESSAGE);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [login]);

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Toggle theme"
          className="text-muted-foreground"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Moon /> : <Sun />}
        </Button>
      </div>

      <div className="w-full max-w-sm">
        <Card className="gap-0 rounded-2xl p-8">
          <CardHeader className="items-center gap-0 px-0 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wallet className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">Spend Tracer</h1>
            <CardDescription className="mt-1 text-sm">
              Sign in to see your expenses
            </CardDescription>
          </CardHeader>

          <CardContent className="px-0 pt-8">
            <div role="status" aria-live="polite" className="sr-only">
              {error ? "" : ready ? "Google sign-in is ready." : "Loading Google sign-in."}
            </div>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!ready && !error && (
              <Button type="button" variant="outline" size="lg" disabled className="w-full gap-3">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                Loading…
              </Button>
            )}
            <div ref={buttonRef} className="flex w-full justify-center" />
          </CardContent>

          <CardFooter className="items-start px-0 pt-6">
            <div className="flex w-full items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Access is limited to allowlisted accounts. Everyone else is rejected at sign-in.
            </div>
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Spend Tracer · personal expense tracker
        </p>
      </div>
    </main>
  );
}
