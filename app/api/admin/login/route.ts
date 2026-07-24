import { createHmac } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedSignupRequest } from "@/lib/signup-security";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  ADMIN_MFA_CHALLENGE_COOKIE,
  ADMIN_MFA_CHALLENGE_TTL_SECONDS,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

const getCredentialsByEmail = makeFunctionReference<
  "query",
  { adminSecret: string; email: string },
  { id: string; passwordHash: string; mfaEnabled: boolean } | null
>("admin:getCredentialsByEmail");

const consumeLoginRateLimit = makeFunctionReference<
  "mutation",
  { adminSecret: string; key: string; limit: number },
  { limited: boolean }
>("admin:consumeLoginRateLimit");

const createSession = makeFunctionReference<
  "mutation",
  { adminSecret: string; adminUserId: string; tokenHash: string; expiresAt: number; userAgent?: string },
  void
>("admin:createSession");

const createMfaChallenge = makeFunctionReference<
  "mutation",
  { adminSecret: string; adminUserId: string; tokenHash: string },
  void
>("admin:createMfaChallenge");

// Computed once at module load so a lookup miss still pays the same scrypt
// cost as a real comparison — otherwise response time would leak which
// email addresses have an admin account.
const DUMMY_HASH = hashPassword(generateSessionToken());

function clientAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

const GENERIC_ERROR = "Invalid email or password.";

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

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 415 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 2_000) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: GENERIC_ERROR }, { status: 400 });
  }

  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminSecret = process.env.ADMIN_ACTION_SECRET;
  if (!convexUrl || !adminSecret) {
    return NextResponse.json({ ok: false, message: "Admin sign-in is not configured in this environment." }, { status: 503 });
  }

  const { email, password } = parsed.data;
  const client = new ConvexHttpClient(convexUrl);
  const address = clientAddress(request);
  const digest = (scope: string) => createHmac("sha256", adminSecret).update(scope).digest("hex");

  try {
    const addressLimit = await client.mutation(consumeLoginRateLimit, {
      adminSecret,
      key: digest(`admin-login:address:${address}`),
      limit: 20,
    });
    const addressEmailLimit = await client.mutation(consumeLoginRateLimit, {
      adminSecret,
      key: digest(`admin-login:address-email:${address}:${email}`),
      limit: 6,
    });
    if (addressLimit.limited || addressEmailLimit.limited) {
      return NextResponse.json(
        { ok: false, message: "Too many attempts. Please wait fifteen minutes and try again." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    const credentials = await client.query(getCredentialsByEmail, { adminSecret, email });
    const passwordValid = verifyPassword(password, credentials?.passwordHash ?? DUMMY_HASH);

    if (!credentials || !passwordValid) {
      return NextResponse.json({ ok: false, message: GENERIC_ERROR }, { status: 401 });
    }

    if (credentials.mfaEnabled) {
      const challengeToken = generateSessionToken();
      await client.mutation(createMfaChallenge, {
        adminSecret,
        adminUserId: credentials.id,
        tokenHash: hashSessionToken(challengeToken),
      });

      const response = NextResponse.json(
        { ok: true, mfaRequired: true },
        { headers: { "Cache-Control": "no-store" } },
      );
      response.cookies.set(ADMIN_MFA_CHALLENGE_COOKIE, challengeToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: ADMIN_MFA_CHALLENGE_TTL_SECONDS,
      });
      return response;
    }

    const token = generateSessionToken();
    await client.mutation(createSession, {
      adminSecret,
      adminUserId: credentials.id,
      tokenHash: hashSessionToken(token),
      expiresAt: sessionExpiry(),
      userAgent: request.headers.get("user-agent")?.slice(0, 200),
    });

    const response = NextResponse.json(
      { ok: true, mfaRequired: false },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "Sign-in is temporarily unavailable. Please try again shortly." }, { status: 502 });
  }
}
