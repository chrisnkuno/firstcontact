import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { isTrustedSignupRequest } from "@/lib/signup-security";
import { getAdminSession } from "@/lib/admin-auth";
import { buildOtpauthUri, generateTotpSecret } from "@/lib/totp";

export const dynamic = "force-dynamic";

const getMfaSecret = makeFunctionReference<
  "query",
  { adminSecret: string; adminUserId: string },
  { mfaSecret: string | null; mfaEnabled: boolean; email: string } | null
>("admin:getMfaSecret");

const setMfaSecret = makeFunctionReference<
  "mutation",
  { adminSecret: string; adminUserId: string; mfaSecret: string },
  void
>("admin:setMfaSecret");

// Only valid for first-time enrollment. Once mfaEnabled is true, a session
// cookie alone must never be enough to replace the TOTP secret — otherwise a
// hijacked session could silently swap in an attacker-controlled secret,
// defeating "mandatory MFA" entirely. There is deliberately no self-service
// re-enrollment path yet; see docs/LAUNCH_READINESS.md.
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

  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminSecret = process.env.ADMIN_ACTION_SECRET;
  if (!convexUrl || !adminSecret) {
    return NextResponse.json({ ok: false, message: "Admin actions are not configured in this environment." }, { status: 503 });
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const state = await client.query(getMfaSecret, { adminSecret, adminUserId: session.adminUserId });
    if (state?.mfaEnabled) {
      return NextResponse.json(
        { ok: false, message: "MFA is already enabled for this account. Contact an operator to reset it." },
        { status: 403 },
      );
    }

    const secret = generateTotpSecret();
    const otpauthUri = buildOtpauthUri({ secret, email: session.email, issuer: "FirstContact" });
    await client.mutation(setMfaSecret, { adminSecret, adminUserId: session.adminUserId, mfaSecret: secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 240 });
    return NextResponse.json(
      { ok: true, secret, otpauthUri, qrDataUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, message: "Could not start MFA setup right now." }, { status: 502 });
  }
}
