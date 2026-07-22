import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { z } from "zod";
import { evaluateContactPolicy } from "@/lib/compliance";

const sendSchema = z.object({
  to: z.string().email(), subject: z.string().min(3).max(180), text: z.string().min(20).max(10_000),
  approved: z.literal(true), sourceUrl: z.string().url(), contactType: z.enum(["generic_business", "named_business", "unknown"]),
  jurisdictionReviewed: z.boolean(), isSuppressed: z.boolean(), unsubscribeUrl: z.string().url(), senderPostalAddress: z.string().min(10),
  idempotencyKey: z.string().min(16).max(256),
});

function hasValidOperatorToken(request: Request) {
  const expected = process.env.OUTBOUND_API_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: Request) {
  // Replace this deployment token with identity-derived authorization once the
  // application's auth adapter is configured. It prevents an accidental relay.
  if (!hasValidOperatorToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = sendSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "Invalid or unapproved send request", issues: input.error.flatten() }, { status: 400 });
  const policy = evaluateContactPolicy({ outboundEnabled: process.env.OUTBOUND_EMAIL_ENABLED === "true", approved: input.data.approved, hasSource: Boolean(input.data.sourceUrl), isSuppressed: input.data.isSuppressed, contactType: input.data.contactType, jurisdictionReviewed: input.data.jurisdictionReviewed, hasPostalIdentity: Boolean(input.data.senderPostalAddress), hasUnsubscribe: Boolean(input.data.unsubscribeUrl) });
  if (!policy.allowed) return NextResponse.json({ error: "Outbound policy blocked this message", reasons: policy.reasons }, { status: 403 });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return NextResponse.json({ error: "Resend is not configured" }, { status: 503 });
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({ from: process.env.RESEND_FROM, to: input.data.to, subject: input.data.subject, text: `${input.data.text}\n\n${input.data.senderPostalAddress}\nUnsubscribe: ${input.data.unsubscribeUrl}`, headers: { "List-Unsubscribe": `<${input.data.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }, tags: [{ name: "application", value: "firstcontact" }] }, { idempotencyKey: input.data.idempotencyKey });
  if (result.error) return NextResponse.json({ error: "Email provider rejected the message", detail: result.error.message }, { status: 502 });
  return NextResponse.json({ status: "accepted", id: result.data?.id });
}
