import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function urlDir(rel: string): string {
  return fileURLToPath(new URL(rel, import.meta.url));
}

/**
 * Resolve a real media fixture used by the token-spending tests.
 * Looks in `downloads/` (live bot data) first, then in `test/fixtures/`
 * for committed anonymized fixtures. Returns null when absent, so tests
 * can skip instead of failing on a fresh checkout.
 */
export function fixtureFile(kind: "photos" | "voice", name: string): string | null {
  const candidates = [urlDir(`../downloads/${name}`), urlDir(`./fixtures/${kind}/${name}`)];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}
