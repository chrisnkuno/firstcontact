import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import { FOUNDER_SESSION_COOKIE, hashSessionToken } from "@/lib/founder-auth";

export const dynamic = "force-dynamic";

const revokeSession = makeFunctionReference<"mutation", { founderSecret: string; tokenHash: string }, void>(
  "founder:revokeSession",
);

export async function POST(request: NextRequest) {
  const token = request.cookies.get(FOUNDER_SESSION_COOKIE)?.value;
  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const founderSecret = process.env.FOUNDER_ACTION_SECRET;

  if (token && convexUrl && founderSecret) {
    try {
      const client = new ConvexHttpClient(convexUrl);
      await client.mutation(revokeSession, { founderSecret, tokenHash: hashSessionToken(token) });
    } catch {
      // Best-effort revocation — the cookie is cleared either way below, and
      // expired sessions are swept by the daily maintenance job.
    }
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(FOUNDER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
