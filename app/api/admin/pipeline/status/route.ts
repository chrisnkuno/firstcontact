import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isTrustedSignupRequest } from "@/lib/signup-security";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  signupId: z.string().trim().min(1).max(60),
  status: z.enum(["new", "reviewing", "invited", "active", "declined"]),
});

const updateSignupStatus = makeFunctionReference<
  "mutation",
  { adminSecret: string; adminUserId: string; signupId: string; status: string },
  { updated: boolean }
>("admin:updateSignupStatus");

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

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 415 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid status update." }, { status: 400 });
  }

  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminSecret = process.env.ADMIN_ACTION_SECRET;
  if (!convexUrl || !adminSecret) {
    return NextResponse.json({ ok: false, message: "Admin actions are not configured in this environment." }, { status: 503 });
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(updateSignupStatus, {
      adminSecret,
      adminUserId: session.adminUserId,
      signupId: parsed.data.signupId,
      status: parsed.data.status,
    });
    return NextResponse.json({ ok: true, updated: result.updated }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not update this signup right now." }, { status: 502 });
  }
}
