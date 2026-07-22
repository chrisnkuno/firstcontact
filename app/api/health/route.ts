import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const providers = {
    convex: Boolean(process.env.NEXT_PUBLIC_CONVEX_URL),
    exa: Boolean(process.env.EXA_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    resend: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
    outbound: process.env.OUTBOUND_EMAIL_ENABLED === "true",
  };
  return NextResponse.json({
    status: "ok",
    mode: Object.values(providers).slice(0, 4).every(Boolean) ? "configured" : "preview",
    providers,
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
