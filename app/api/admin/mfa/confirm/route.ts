import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedSignupRequest } from "@/lib/signup-security";
import { getAdminSession } from "@/lib/admin-auth";
import { verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

const getMfaSecret = makeFunctionReference<
  "query",
  { adminSecret: string; adminUserId: string },
  { mfaSecret: string | null; mfaEnabled: boolean; email: string } | null
>("admin:getMfaSecret");

const enableMfa = makeFunctionReference<"mutation", { adminSecret: string; adminUserId: string }, void>(
  "admin:enableMfa",
);

export async function POST(request: NextRequest) {
  if (
    !isTrustedSignupRequest({
      configuredOrigin: process.env.NEXT_PUBLIC_APP_URL,
      origin: request.headers.get("origin"),
      requestOrigin: request.nextUrl.origin,
      secFetchSite: request.headers.get("sec-fetch-site"),
    })
  ) {
    return NextResponse.json({ ok: false, message: "This request was not accepted." }, { status: 403 });
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const parsed = codeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Enter the 6-digit code from your authenticator app." }, { status: 400 });
  }

  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminSecret = process.env.ADMIN_ACTION_SECRET;
  if (!convexUrl || !adminSecret) {
    return NextResponse.json({ ok: false, message: "Admin actions are not configured in this environment." }, { status: 503 });
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const state = await client.query(getMfaSecret, { adminSecret, adminUserId: session.adminUserId });
    if (!state?.mfaSecret || !verifyTotp(state.mfaSecret, parsed.data.code)) {
      return NextResponse.json({ ok: false, message: "That code did not match. Please try again." }, { status: 401 });
    }

    await client.mutation(enableMfa, { adminSecret, adminUserId: session.adminUserId });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not confirm MFA right now." }, { status: 502 });
  }
}
