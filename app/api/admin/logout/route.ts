import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, hashSessionToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const revokeSession = makeFunctionReference<"mutation", { adminSecret: string; tokenHash: string }, void>(
  "admin:revokeSession",
);

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminSecret = process.env.ADMIN_ACTION_SECRET;

  if (token && convexUrl && adminSecret) {
    try {
      const client = new ConvexHttpClient(convexUrl);
      await client.mutation(revokeSession, { adminSecret, tokenHash: hashSessionToken(token) });
    } catch {
      // Best-effort revocation — the cookie is cleared either way below, and
      // expired sessions are swept by the daily maintenance job.
    }
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
