import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Resolve a real voice-note fixture from `downloads/` (live bot data) for
 * the token-spending tests. Returns null when absent, so the test skips
 * instead of failing on a fresh checkout.
 */
export function voiceFixture(name: string): string | null {
  const path = fileURLToPath(new URL(`../downloads/${name}`, import.meta.url));
  return existsSync(path) ? path : null;
}
