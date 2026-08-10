import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { preflight, submitCatalogueInterest, submitSignup, translate } from "./publicRoutes";
import { verifyWebhookSignature } from "../lib/webhook-signature";

const http = httpRouter();

// Convex Auth's own endpoints (token exchange, refresh, OAuth callbacks).
// With the app served as static files from GitHub Pages, this is the only
// server-side auth surface that exists.
auth.addHttpRoutes(http);

// Public ingestion. Each POST needs a matching OPTIONS route because the
// browser preflights any cross-origin request carrying `content-type:
// application/json`, and an unhandled preflight fails the request before the
// POST is ever attempted.
http.route({ path: "/public/signups", method: "POST", handler: submitSignup });
http.route({ path: "/public/signups", method: "OPTIONS", handler: preflight });
http.route({ path: "/public/catalogue-interest", method: "POST", handler: submitCatalogueInterest });
http.route({ path: "/public/catalogue-interest", method: "OPTIONS", handler: preflight });
http.route({ path: "/public/translate", method: "POST", handler: translate });
http.route({ path: "/public/translate", method: "OPTIONS", handler: preflight });

/**
 * Resend delivery webhook.
 *
 * Previously a Next.js route that verified the signature and then discarded
 * the event with a "production should call a Convex mutation here" comment.
 * It now completes the loop: verified events are recorded idempotently by
 * `svix-id`, and the bounce/complaint types additionally write a suppression,
 * because those two are the ones with a legal and deliverability obligation
 * attached rather than merely being interesting telemetry.
 *
 * Always answers 2xx once the signature is valid, even for event types it does
 * not act on — Resend retries non-2xx, and retrying an event we deliberately
 * ignore just burns delivery attempts.
 */
http.route({
  path: "/webhooks/resend",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      return new Response(JSON.stringify({ error: "Webhook verification is not configured" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await request.text();
    const verification = await verifyWebhookSignature({
      secret,
      body,
      headers: {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature"),
      },
    });

    if (!verification.valid) {
      // The reason is logged rather than returned: telling an unauthenticated
      // caller *why* their signature failed helps them iterate toward a valid one.
      console.warn("resend webhook rejected", verification.reason);
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    let event: { type?: string; data?: { email_id?: string; to?: string[] | string } };
    try {
      event = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: "Malformed webhook body" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const eventId = request.headers.get("svix-id")!;
    const recipients = Array.isArray(event.data?.to)
      ? event.data.to
      : event.data?.to
        ? [event.data.to]
        : [];

    const result = await ctx.runMutation(internal.webhooks.recordResendEvent, {
      eventId,
      type: event.type ?? "unknown",
      payload: event,
      recipients,
    });

    return new Response(JSON.stringify({ received: true, duplicate: result.duplicate }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
});

export default http;
