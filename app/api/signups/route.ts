import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  interestSignupSchema,
  type InterestSignup,
} from "@/lib/domain";

export const dynamic = "force-dynamic";

const requestSchema = interestSignupSchema.and(
  z.object({
    // Honeypot: must stay empty. Trimmed so that stray whitespace (e.g. from
    // an errant autofill pass) doesn't false-positive a real submission.
    company: z.string().trim().max(0).optional(),
  }),
);

const FRIENDLY_FIELD_LABELS: Record<string, string> = {
  accountType: "how you'll use FirstContact",
  name: "your name",
  email: "your email",
  location: "your location",
  organizationName: "your organization name",
  individualRole: "your role",
  stage: "your current stage",
  website: "your website link (include https://)",
  summary: "the summary of what you're building or looking for",
  context: "the context field",
  goals: "what you'd like to do",
  targetRegions: "your capital regions of interest",
  referralSource: "how you found FirstContact",
  consentToProcess: "the consent checkbox",
};

function friendlyValidationMessage(fieldErrors: Record<string, string[] | undefined>) {
  const fields = Object.keys(fieldErrors).filter((key) => fieldErrors[key]?.length);
  if (!fields.length) return "Please review the highlighted information.";
  const labels = fields.slice(0, 3).map((key) => FRIENDLY_FIELD_LABELS[key] ?? key);
  return `Please check ${labels.join(", ")} and try again.`;
}

type SignupMutationArgs = Omit<InterestSignup, "consentToProcess"> & {
  ingestSecret: string;
  source: string;
  consentRecordedAt: number;
};

type SignupMutationResult = {
  id: string;
  status: "new" | "reviewing" | "invited" | "active" | "declined";
  created: boolean;
};

const submitSignup = makeFunctionReference<
  "mutation",
  SignupMutationArgs,
  SignupMutationResult
>("signups:submit");

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS = 5;

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
  if (Number(request.headers.get("content-length") ?? 0) > 32_000) {
    return NextResponse.json(
      { ok: false, message: "This submission is too large." },
      { status: 413 },
    );
  }

  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      {
        ok: false,
        message: "Too many attempts. Please wait a few minutes and try again.",
      },
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
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return NextResponse.json(
      {
        ok: false,
        message: friendlyValidationMessage(fieldErrors),
        fields: fieldErrors,
      },
      { status: 400 },
    );
  }

  const convexUrl =
    process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const ingestSecret = process.env.SIGNUP_INGEST_SECRET;

  if (!convexUrl || !ingestSecret) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Signups are temporarily unavailable. Your information was not stored.",
      },
      { status: 503 },
    );
  }

  const signup = parsed.data;

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(submitSignup, {
      accountType: signup.accountType,
      name: signup.name,
      email: signup.email,
      location: signup.location,
      organizationName: signup.organizationName,
      website: signup.website,
      individualRole: signup.individualRole,
      stage: signup.stage,
      summary: signup.summary,
      context: signup.context,
      goals: signup.goals,
      targetRegions: signup.targetRegions,
      referralSource: signup.referralSource,
      productUpdates: signup.productUpdates,
      ingestSecret,
      source: "web-onboarding",
      consentRecordedAt: Date.now(),
    });
    const reference = `FC-${result.id.slice(-8).toUpperCase()}`;

    return NextResponse.json(
      {
        ok: true,
        reference,
        status: result.status,
        created: result.created,
      },
      {
        status: result.created ? 201 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "We could not save your signup right now. Please try again shortly.",
      },
      { status: 502 },
    );
  }
}
