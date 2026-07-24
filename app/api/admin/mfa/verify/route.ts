import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedSignupRequest } from "@/lib/signup-security";
import { verifyTotp } from "@/lib/totp";
import {
  ADMIN_MFA_CHALLENGE_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

const consumeMfaChallenge = makeFunctionReference<
  "mutation",
  { adminSecret: string; tokenHash: string },
  { adminUserId: string; mfaSecret: string | null } | null
>("admin:consumeMfaChallenge");

const createSession = makeFunctionReference<
  "mutation",
  { adminSecret: string; adminUserId: string; tokenHash: string; expiresAt: number; userAgent?: string },
  void
>("admin:createSession");

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

  const challengeToken = request.cookies.get(ADMIN_MFA_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) {
    return NextResponse.json({ ok: false, message: "Your sign-in attempt expired. Please sign in again." }, { status: 401 });
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
    return NextResponse.json({ ok: false, message: "Admin sign-in is not configured in this environment." }, { status: 503 });
  }

  const client = new ConvexHttpClient(convexUrl);

  try {
    // The challenge is deleted the instant it's read, so a stolen or reused
    // challenge cookie can only ever be tried once.
    const challenge = await client.mutation(consumeMfaChallenge, {
      adminSecret,
      tokenHash: hashSessionToken(challengeToken),
    });

    const response = NextResponse.json({ ok: false, message: "That code did not match. Please try again." }, { status: 401 });
    response.cookies.set(ADMIN_MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });

    if (!challenge || !challenge.mfaSecret || !verifyTotp(challenge.mfaSecret, parsed.data.code)) {
      return response;
    }

    const token = generateSessionToken();
    await client.mutation(createSession, {
      adminSecret,
      adminUserId: challenge.adminUserId,
      tokenHash: hashSessionToken(token),
      expiresAt: sessionExpiry(),
      userAgent: request.headers.get("user-agent")?.slice(0, 200),
    });

    const success = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    success.cookies.set(ADMIN_MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
    success.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });
    return success;
  } catch {
    return NextResponse.json({ ok: false, message: "Sign-in is temporarily unavailable. Please try again shortly." }, { status: 502 });
  }
}
