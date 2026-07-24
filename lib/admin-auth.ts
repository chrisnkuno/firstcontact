import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export const ADMIN_SESSION_COOKIE = "fc_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export const ADMIN_SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

export const ADMIN_MFA_CHALLENGE_COOKIE = "fc_admin_mfa_challenge";
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const ADMIN_MFA_CHALLENGE_TTL_SECONDS = MFA_CHALLENGE_TTL_MS / 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Only the hash is ever persisted (in Convex) or sent to Convex — the raw
// token lives solely in the HttpOnly cookie, so a database read alone can
// never yield a usable session.
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(): number {
  return Date.now() + SESSION_TTL_MS;
}

export type AdminSession = {
  adminUserId: string;
  email: string;
  expiresAt: number;
};

const getSessionRef = makeFunctionReference<
  "query",
  { adminSecret: string; tokenHash: string },
  AdminSession | null
>("admin:getSession");

function convexClient(): ConvexHttpClient | null {
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;
  return new ConvexHttpClient(convexUrl);
}

// Server-only: reads the session cookie, hashes it, and checks it against
// Convex. Returns null rather than throwing on any misconfiguration or
// expired/missing session — callers decide whether that means a redirect
// (pages) or a 401 (API routes).
export async function getAdminSession(): Promise<AdminSession | null> {
  const adminSecret = process.env.ADMIN_ACTION_SECRET;
  const client = convexClient();
  if (!adminSecret || !client) return null;

  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await client.query(getSessionRef, { adminSecret, tokenHash: hashSessionToken(token) });
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
