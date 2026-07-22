import { NextResponse } from "next/server";
import { Webhook } from "svix";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook verification is not configured" }, { status: 503 });
  const body = await request.text();
  try {
    const event = new Webhook(secret).verify(body, { "svix-id": request.headers.get("svix-id") ?? "", "svix-timestamp": request.headers.get("svix-timestamp") ?? "", "svix-signature": request.headers.get("svix-signature") ?? "" }) as { type: string; data?: { email_id?: string } };
    // Production deployments should call a Convex mutation keyed by svix-id here.
    return NextResponse.json({ received: true, event: event.type, emailId: event.data?.email_id ?? null });
  } catch { return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 }); }
}
