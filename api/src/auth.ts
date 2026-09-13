import { OAuth2Client } from "google-auth-library";
import { config } from "./config.ts";

/** The verified claims we care about from a Google ID token. */
export interface GoogleIdentity {
  email: string;
  name: string | null;
  avatar: string | null;
  subject: string;
}

const client = new OAuth2Client();

/** Whether the given email is on the allowlist (case-insensitive). */
export function isAllowedEmail(email: string): boolean {
  return config.allowedEmails.includes(email.toLowerCase());
}

/**
 * Verify a Google ID token and return its identity. Throws when the token is
 * invalid or expired, or when it lacks the required claims.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: config.googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Google ID token is missing required claims");
  }
  return {
    email: payload.email,
    name: payload.name ?? null,
    avatar: payload.picture ?? null,
    subject: payload.sub,
  };
}
