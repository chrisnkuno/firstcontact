import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { catalogueInterestSchema, type CatalogueInterest } from "@/lib/domain";
import { catalogueProfiles } from "@/lib/catalogue-data";

export const dynamic = "force-dynamic";

const requestSchema = catalogueInterestSchema.and(
  z.object({
    company: z.string().trim().max(0).optional(),
  }),
);

type ExpressInterestArgs = CatalogueInterest & { ingestSecret: string };
type ExpressInterestResult = { created: boolean };

const expressInterest = makeFunctionReference<
  "mutation",
  ExpressInterestArgs,
  ExpressInterestResult
>("catalogue:expressInterest");

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS = 10;

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(address).digest("hex");
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = rateLimit.get(key);

  if (!current || current.resetAt <= now) {
    rateLimit.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > MAX_SUBMISSIONS;
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > 8_000) {
    return NextResponse.json(
      { ok: false, message: "This submission is too large." },
      { status: 413 },
    );
  }

  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "The submission could not be read." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Please add a valid email address." },
      { status: 400 },
    );
  }

  if (!catalogueProfiles.some((profile) => profile.id === parsed.data.profileId)) {
    return NextResponse.json(
      { ok: false, message: "That catalogue profile could not be found." },
      { status: 404 },
    );
  }

  const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const ingestSecret = process.env.SIGNUP_INGEST_SECRET;

  if (!convexUrl || !ingestSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Interest signals are temporarily unavailable. Nothing was stored.",
      },
      { status: 503 },
    );
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(expressInterest, {
      profileId: parsed.data.profileId,
      email: parsed.data.email,
      note: parsed.data.note,
      ingestSecret,
    });

    return NextResponse.json(
      { ok: true, created: result.created },
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "We could not save your interest right now. Please try again shortly." },
      { status: 502 },
    );
  }
}
