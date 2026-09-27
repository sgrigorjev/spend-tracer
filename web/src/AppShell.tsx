import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Moon, Settings, Sun, Wallet } from "lucide-react";
import { useAuth } from "./auth";
import { useTheme } from "./theme";
import { Button } from "./components/ui/button";

/** Two initials for the avatar fallback, from the name or the email. */
function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

/** The shared header and page frame for every authenticated route. */
export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="font-semibold tracking-tight">Spend Tracer</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
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

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="flex items-center gap-2 rounded-lg border border-border bg-background py-1.5 pl-1.5 pr-2 text-sm transition-colors hover:bg-accent"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                    {user ? initials(user.name, user.email) : "?"}
                  </span>
                )}
                <span className="hidden max-w-40 truncate font-medium sm:block">
                  {user?.name ?? user?.email}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {open && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                >
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">{user?.name ?? "Signed in"}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleLogout()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
