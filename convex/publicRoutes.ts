import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { z } from "zod";
import { catalogueInterestSchema, interestSignupSchema } from "../lib/domain";
import { supportedLanguages } from "../lib/languages";
import { openAiStructured } from "./providers";
import {
  configuredAllowedOrigins,
  isTrustedSubmissionOrigin,
} from "../lib/signup-security";
import {
  catalogueRateLimitKeys,
  clientAddressFromHeaders,
  signupRateLimitKeys,
} from "../lib/rate-limit-keys";

/**
 * Public, unauthenticated ingestion endpoints.
 *
 * These are HTTP actions rather than plain public mutations for one reason: a
 * Convex mutation cannot see the caller's IP address, and dropping IP-based
 * rate limiting during the migration would have been a real regression. An
 * HTTP action gets the request headers, so the existing address+email limiter
 * survives the move off Next.js intact.
 */

const languageCodes = supportedLanguages.map((language) => language.code) as [string, ...string[]];

const translationRequestSchema = z.object({
  texts: z.array(z.string().trim().min(1).max(600)).min(1).max(80),
  target: z.enum(languageCodes),
});

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = configuredAllowedOrigins();
  // Echo the caller's origin only when it is on the allowlist — never `*`,
  // which would let any page on the internet POST here from a visitor's browser.
  const allowOrigin = origin && allowed.includes(origin) ? origin : (allowed[0] ?? "");
  return {
    "content-type": "application/json",
    ...(allowOrigin ? { "access-control-allow-origin": allowOrigin } : {}),
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

export const preflight = httpAction(async (_ctx, request) => {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
});

export const submitSignup = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin");
  if (!isTrustedSubmissionOrigin({ allowedOrigins: configuredAllowedOrigins(), origin })) {
    return json({ ok: false, message: "This origin may not submit signups" }, 403, origin);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Malformed request body" }, 400, origin);
  }

  const parsed = interestSignupSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      { ok: false, message: "Some details need another look", fields: parsed.error.flatten().fieldErrors },
      422,
      origin,
    );
  }

  const limiterSecret = process.env.RATE_LIMIT_SECRET;
  if (!limiterSecret) {
    // Failing closed: without the limiter secret the endpoint has no abuse
    // control at all, and an open, unmetered write endpoint is worse than a
    // temporarily unavailable one.
    return json({ ok: false, message: "Signups are temporarily unavailable" }, 503, origin);
  }

  const keys = await signupRateLimitKeys({
    address: clientAddressFromHeaders(request.headers),
    email: parsed.data.email,
    secret: limiterSecret,
  });

  // The broad address limit blocks bursts without locking out a shared
  // office or mobile network after only a handful of legitimate signups; the
  // tighter address+email limit catches repeated submissions of the same record.
  const address = await ctx.runMutation(internal.rateLimit.consume, { key: keys.addressKey, limit: 40 });
  if (address.limited) return json({ ok: false, message: "Too many submissions. Try again shortly." }, 429, origin);
  const addressEmail = await ctx.runMutation(internal.rateLimit.consume, {
    key: keys.addressEmailKey,
    limit: 6,
  });
  if (addressEmail.limited) {
    return json({ ok: false, message: "Too many submissions. Try again shortly." }, 429, origin);
  }

  // `consentToProcess` is a submit-time assertion (the schema types it as
  // literal `true`, so reaching this line means it was given) rather than a
  // stored field. What gets persisted is *when* consent happened, which is the
  // part that has to survive a later data-protection request — so the flag is
  // dropped here and `consentRecordedAt` carries the fact.
  const { consentToProcess: _consentToProcess, ...signup } = parsed.data;
  const result = await ctx.runMutation(internal.signups.record, {
    ...signup,
    source: "web",
    consentRecordedAt: Date.now(),
  });

  // A short, human-quotable reference so someone can point at their own
  // submission in an email without us handing out a raw database id.
  const reference = result.id.slice(-8).toUpperCase();
  return json(
    { ok: true, reference, created: result.created, status: result.status },
    result.created ? 201 : 200,
    origin,
  );
});

/**
 * Best-effort UI translation.
 *
 * Public and rate-limited by address rather than authenticated, because the
 * point is that someone who does not read English can navigate the *marketing*
 * pages before they have an account. Without `OPENAI_API_KEY` it echoes the
 * input back untranslated rather than fabricating a translation.
 */
export const translate = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin");
  if (!isTrustedSubmissionOrigin({ allowedOrigins: configuredAllowedOrigins(), origin })) {
    return json({ ok: false, message: "This origin may not request translations" }, 403, origin);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Malformed request body" }, 400, origin);
  }

  const parsed = translationRequestSchema.safeParse(payload);
  if (!parsed.success) return json({ ok: false, message: "Invalid translation request" }, 400, origin);

  const { texts, target } = parsed.data;
  if (target === "en") {
    return json({ mode: "identity", translated: false, translations: texts }, 200, origin);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ mode: "unconfigured", translated: false, translations: texts }, 200, origin);

  const limiterSecret = process.env.RATE_LIMIT_SECRET;
  if (limiterSecret) {
    const keys = await signupRateLimitKeys({
      address: clientAddressFromHeaders(request.headers),
      email: `translate:${target}`,
      secret: limiterSecret,
    });
    const limited = await ctx.runMutation(internal.rateLimit.consume, {
      key: keys.addressEmailKey,
      limit: 60,
    });
    if (limited.limited) {
      // Falls back to the untranslated text rather than erroring: a rate limit
      // should degrade the interface, not break it.
      return json({ mode: "rate_limited", translated: false, translations: texts }, 200, origin);
    }
  }

  const language = supportedLanguages.find((entry) => entry.code === target);
  const result = await openAiStructured<{ translations: string[] }>({
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-5-nano",
    instructions: `Translate each string in the input array into ${language?.label ?? target} (${language?.nativeLabel ?? target}). Keep the same order and count as the input. Preserve numbers, product names like "FirstContact", and placeholders exactly. Keep the tone concise and natural for interface copy.`,
    input: { texts },
    schemaName: "ui_translations",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { translations: { type: "array", items: { type: "string" } } },
      required: ["translations"],
    },
  });

  if (!result.ok || result.data.translations.length !== texts.length) {
    return json({ mode: "unavailable", translated: false, translations: texts }, 200, origin);
  }
  return json({ mode: "live", translated: true, translations: result.data.translations }, 200, origin);
});

export const submitCatalogueInterest = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin");
  if (!isTrustedSubmissionOrigin({ allowedOrigins: configuredAllowedOrigins(), origin })) {
    return json({ ok: false, message: "This origin may not submit interest" }, 403, origin);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Malformed request body" }, 400, origin);
  }

  const parsed = catalogueInterestSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      { ok: false, message: "Some details need another look", fields: parsed.error.flatten().fieldErrors },
      422,
      origin,
    );
  }

  const limiterSecret = process.env.RATE_LIMIT_SECRET;
  if (!limiterSecret) return json({ ok: false, message: "Temporarily unavailable" }, 503, origin);

  const keys = await catalogueRateLimitKeys({
    address: clientAddressFromHeaders(request.headers),
    email: parsed.data.email,
    secret: limiterSecret,
  });
  const address = await ctx.runMutation(internal.rateLimit.consume, { key: keys.addressKey, limit: 40 });
  if (address.limited) return json({ ok: false, message: "Too many submissions. Try again shortly." }, 429, origin);
  const addressEmail = await ctx.runMutation(internal.rateLimit.consume, {
    key: keys.addressEmailKey,
    limit: 6,
  });
  if (addressEmail.limited) {
    return json({ ok: false, message: "Too many submissions. Try again shortly." }, 429, origin);
  }

  const result = await ctx.runMutation(internal.catalogue.recordInterest, parsed.data);
  return json({ ok: true, created: result.created }, result.created ? 201 : 200, origin);
});
