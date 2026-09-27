import { useEffect, useState, type FormEvent } from "react";
import { Check, CircleAlert } from "lucide-react";
import { useAuth } from "./auth";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { TelegramSettings } from "./components/TelegramSettings";

const CURRENCIES = Intl.supportedValuesOf("currency");

/**
 * IANA timezone options. `Intl.supportedValuesOf` omits some valid zones and
 * aliases (for example `Europe/Kyiv` and `UTC`), so the current value and UTC
 * are always included.
 */
function timeZoneOptions(current: string): string[] {
  const zones = new Set<string>(Intl.supportedValuesOf("timeZone"));
  zones.add("UTC");
  if (current) zones.add(current);
  return [...zones].sort();
}

interface Settings {
  display_currency: string;
  display_timezone: string;
}

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border disabled:opacity-50";

export function Settings() {
  const { refresh } = useAuth();
  const [currency, setCurrency] = useState("");
  const [timezone, setTimezone] = useState("");
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "saved" | "error"; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then(async (res) => {
        if (!res.ok) throw new Error("unavailable");
        return (await res.json()) as Settings;
      })
      .then((data) => {
        if (cancelled) return;
        setCurrency(data.display_currency);
        setTimezone(data.display_timezone);
        setZones(timeZoneOptions(data.display_timezone));
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: "error", message: "Could not load your settings." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_currency: currency, display_timezone: timezone }),
      });
      const payload = (await res.json().catch(() => null)) as (Partial<Settings> & { error?: string }) | null;
      if (!res.ok) {
        setStatus({ kind: "error", message: payload?.error ?? "Could not save your settings." });
        return;
      }
      if (payload?.display_currency) setCurrency(payload.display_currency);
      if (payload?.display_timezone) setTimezone(payload.display_timezone);
      await refresh();
      setStatus({ kind: "saved", message: "Settings saved." });
    } catch {
      setStatus({ kind: "error", message: "Could not save your settings." });
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Account settings</h1>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Display preferences</CardTitle>
          <CardDescription>Choose how amounts and dates are shown to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            {status && (
              <Alert variant={status.kind === "error" ? "destructive" : "default"}>
                {status.kind === "error" ? (
                  <CircleAlert className="h-4 w-4 shrink-0" />
                ) : (
                  <Check className="h-4 w-4 shrink-0" />
                )}
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            )}

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Display currency</span>
              <select
                className={SELECT_CLASS}
                value={currency}
                disabled={busy}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {currency === "" && <option value="" />}
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Timezone</span>
              <select
                className={SELECT_CLASS}
                value={timezone}
                disabled={busy}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {timezone === "" && <option value="" />}
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>

            <Button type="submit" disabled={busy}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <TelegramSettings />
    </section>
  );
}
