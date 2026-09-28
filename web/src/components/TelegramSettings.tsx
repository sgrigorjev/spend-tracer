import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, CircleAlert, ExternalLink, Link2, Unlink } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

/** How often the page asks whether the link completed. */
const POLL_INTERVAL_MS = 3000;

/** One-time link payload returned by the link endpoint. */
interface LinkPayload {
  token: string;
  url: string | null;
  expiresAt: string;
}

type AccountState = "loading" | "linked" | "unlinked" | "error";

/** A pending link held only in memory, for as long as the panel stays open. */
interface PendingLink {
  url: string;
  expiresAt: number;
}

/**
 * Telegram linking panel for the settings page. It mints a single-use token on
 * demand, presents it as both a tappable deep link and a QR code, and polls the
 * link status so a link completed on the phone shows up here without a reload.
 */
export function TelegramSettings() {
  const [account, setAccount] = useState<AccountState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [expired, setExpired] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [issuing, setIssuing] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  // Track mount state so an in-flight link request cannot set state after unmount.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Read the current link state once, and again whenever the user retries.
  useEffect(() => {
    let cancelled = false;
    setAccount("loading");
    fetch("/api/telegram/link/status")
      .then(async (res) => {
        if (!res.ok) throw new Error("status");
        return (await res.json()) as { linked: boolean };
      })
      .then((data) => {
        if (!cancelled) setAccount(data.linked ? "linked" : "unlinked");
      })
      .catch(() => {
        if (!cancelled) setAccount("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const startLinking = useCallback(async () => {
    setIssuing(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = (await res.json().catch(() => null)) as LinkPayload | null;
      if (!mounted.current) return;
      if (!res.ok || !data) {
        setError("Could not create a Telegram link. Try again.");
        return;
      }
      if (data.url === null) {
        setNotConfigured(true);
        return;
      }
      setNotConfigured(false);
      setExpired(false);
      setNow(Date.now());
      setPending({ url: data.url, expiresAt: Date.parse(data.expiresAt) });
    } catch {
      if (mounted.current) setError("Could not create a Telegram link. Try again.");
    } finally {
      if (mounted.current) setIssuing(false);
    }
  }, []);

  const cancelLinking = useCallback(() => {
    setPending(null);
    setExpired(false);
    setError(null);
  }, []);

  const unlinkTelegram = useCallback(async () => {
    setUnlinking(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/link", { method: "DELETE" });
      if (!mounted.current) return;
      if (!res.ok) {
        setConfirmingUnlink(false);
        setError("Could not unlink Telegram. Try again.");
        return;
      }
      setConfirmingUnlink(false);
      setAccount("unlinked");
    } catch {
      if (mounted.current) {
        setConfirmingUnlink(false);
        setError("Could not unlink Telegram. Try again.");
      }
    } finally {
      if (mounted.current) setUnlinking(false);
    }
  }, []);

  // Drive the countdown, and mark the link expired the moment it runs out.
  useEffect(() => {
    if (!pending || expired) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= pending.expiresAt) setExpired(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [pending, expired]);

  // Poll the link status while the panel is open and the token is still valid.
  useEffect(() => {
    if (!pending || expired) return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/telegram/link/status");
        if (!res.ok) return;
        const data = (await res.json()) as { linked: boolean };
        if (data.linked) {
          setPending(null);
          setAccount("linked");
        }
      } catch {
        // A failed poll is not fatal; the next tick retries.
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pending, expired]);

  const remaining = pending ? Math.max(0, Math.ceil((pending.expiresAt - now) / 1000)) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram</CardTitle>
        <CardDescription>Link your Telegram account so the bot records your expenses.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {account === "loading" && <p className="text-sm text-muted-foreground">Checking your link…</p>}

        {account === "error" && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <AlertDescription>Could not read your Telegram link state.</AlertDescription>
            </Alert>
            <Button type="button" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          </div>
        )}

        {account === "linked" && (
          <div className="space-y-4">
            <Alert variant="success">
              <Check className="h-4 w-4 shrink-0" />
              <AlertDescription>Telegram is linked. Messages you send the bot are recorded for this account.</AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {confirmingUnlink ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Unlink Telegram? The bot will stop recording messages from this account.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="destructive" onClick={() => void unlinkTelegram()} disabled={unlinking}>
                    <Unlink /> {unlinking ? "Unlinking…" : "Unlink Telegram"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setConfirmingUnlink(false);
                      setError(null);
                    }}
                    disabled={unlinking}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirmingUnlink(true)}>
                <Unlink /> Unlink Telegram
              </Button>
            )}
          </div>
        )}

        {account === "unlinked" && (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {notConfigured ? (
              <Alert variant="destructive">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <AlertDescription>
                  Telegram linking is not configured on this server. Set TELEGRAM_BOT_USERNAME and reload.
                </AlertDescription>
              </Alert>
            ) : pending ? (
              expired ? (
                <div className="space-y-3">
                  <Alert variant="destructive">
                    <CircleAlert className="h-4 w-4 shrink-0" />
                    <AlertDescription>This link expired. Create a new one to finish linking.</AlertDescription>
                  </Alert>
                  <Button type="button" onClick={() => void startLinking()} disabled={issuing}>
                    <Link2 /> {issuing ? "Creating a link…" : "Create a new link"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Scan the code with your phone, or open the link on the device where Telegram is installed, then
                    press Start in the bot.
                  </p>
                  <div className="w-fit rounded-lg bg-white p-3" role="img" aria-label="QR code for the Telegram link">
                    <QRCodeSVG value={pending.url} size={176} marginSize={4} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <a href={pending.url} rel="noreferrer" className={buttonVariants()}>
                      <ExternalLink /> Open Telegram
                    </a>
                    <span className="text-sm text-muted-foreground">Expires in {remaining}s</span>
                    <Button type="button" variant="ghost" onClick={cancelLinking}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <Button type="button" onClick={() => void startLinking()} disabled={issuing}>
                <Link2 /> {issuing ? "Creating a link…" : "Link Telegram"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
