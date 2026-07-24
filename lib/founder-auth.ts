import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export const FOUNDER_SESSION_COOKIE = "fc_founder_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — low-privilege, read-only, so a longer session is a reasonable tradeoff against re-login friction.

export const FOUNDER_SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(): number {
  return Date.now() + SESSION_TTL_MS;
}

export type FounderSession = {
  founderAccountId: string;
  email: string;
  expiresAt: number;
};

const getSessionRef = makeFunctionReference<
  "query",
  { founderSecret: string; tokenHash: string },
  FounderSession | null
>("founder:getSession");

function convexClient(): ConvexHttpClient | null {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;
  return new ConvexHttpClient(convexUrl);
}

// Server-only: reads the session cookie, hashes it, and checks it against
// Convex. Returns null rather than throwing on any misconfiguration or
// expired/missing session — callers decide whether that means a redirect
// (pages) or a 401 (API routes).
export async function getFounderSession(): Promise<FounderSession | null> {
  const founderSecret = process.env.FOUNDER_ACTION_SECRET;
  const client = convexClient();
  if (!founderSecret || !client) return null;

  const store = await cookies();
  const token = store.get(FOUNDER_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await client.query(getSessionRef, { founderSecret, tokenHash: hashSessionToken(token) });
  } catch {
    return null;
  }
}
