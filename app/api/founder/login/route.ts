import { createHmac } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedSignupRequest } from "@/lib/signup-security";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  FOUNDER_SESSION_COOKIE,
  FOUNDER_SESSION_TTL_SECONDS,
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
} from "@/lib/founder-auth";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

const getCredentialsByEmail = makeFunctionReference<
  "query",
  { founderSecret: string; email: string },
  { id: string; passwordHash: string } | null
>("founder:getCredentialsByEmail");

const consumeLoginRateLimit = makeFunctionReference<
  "mutation",
  { founderSecret: string; key: string; limit: number },
  { limited: boolean }
>("founder:consumeLoginRateLimit");

const createSession = makeFunctionReference<
  "mutation",
  { founderSecret: string; founderAccountId: string; tokenHash: string; expiresAt: number; userAgent?: string },
  void
>("founder:createSession");

// Computed once at module load so a lookup miss still pays the same scrypt
// cost as a real comparison — otherwise response time would leak which
// email addresses have a founder account. Mirrors /api/admin/login.
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
  const founderSecret = process.env.FOUNDER_ACTION_SECRET;
  if (!convexUrl || !founderSecret) {
    return NextResponse.json({ ok: false, message: "Status sign-in is not configured in this environment." }, { status: 503 });
  }

  const { email, password } = parsed.data;
  const client = new ConvexHttpClient(convexUrl);
  const address = clientAddress(request);
  const digest = (scope: string) => createHmac("sha256", founderSecret).update(scope).digest("hex");

  try {
    const addressLimit = await client.mutation(consumeLoginRateLimit, {
      founderSecret,
      key: digest(`founder-login:address:${address}`),
      limit: 20,
    });
    const addressEmailLimit = await client.mutation(consumeLoginRateLimit, {
      founderSecret,
      key: digest(`founder-login:address-email:${address}:${email}`),
      limit: 6,
    });
    if (addressLimit.limited || addressEmailLimit.limited) {
      return NextResponse.json(
        { ok: false, message: "Too many attempts. Please wait fifteen minutes and try again." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    const credentials = await client.query(getCredentialsByEmail, { founderSecret, email });
    const passwordValid = verifyPassword(password, credentials?.passwordHash ?? DUMMY_HASH);

    if (!credentials || !passwordValid) {
      return NextResponse.json({ ok: false, message: GENERIC_ERROR }, { status: 401 });
    }

    const token = generateSessionToken();
    await client.mutation(createSession, {
      founderSecret,
      founderAccountId: credentials.id,
      tokenHash: hashSessionToken(token),
      expiresAt: sessionExpiry(),
      userAgent: request.headers.get("user-agent")?.slice(0, 200),
    });

    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(FOUNDER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: FOUNDER_SESSION_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, message: "Sign-in is temporarily unavailable. Please try again shortly." }, { status: 502 });
  }
}
