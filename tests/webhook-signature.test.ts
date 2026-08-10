import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/lib/webhook-signature";

const SECRET_BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const SECRET = `whsec_${btoa(String.fromCharCode(...SECRET_BYTES))}`;

async function sign(id: string, timestamp: string, body: string, secret = SECRET) {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const binary = atob(raw);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const key = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)),
  );
  return `v1,${btoa(String.fromCharCode(...signature))}`;
}

const now = Date.parse("2026-08-09T12:00:00Z");
const timestamp = String(Math.floor(now / 1000));
const body = JSON.stringify({ type: "email.bounced", data: { to: ["someone@example.org"] } });

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed delivery", async () => {
    const signature = await sign("msg_1", timestamp, body);
    const result = await verifyWebhookSignature({
      secret: SECRET,
      body,
      headers: { id: "msg_1", timestamp, signature },
      now,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const signature = await sign("msg_1", timestamp, body);
    const result = await verifyWebhookSignature({
      secret: SECRET,
      body: body.replace("bounced", "delivered"),
      headers: { id: "msg_1", timestamp, signature },
      now,
    });
    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  // A genuinely-signed delivery replayed hours later is still an attack, so the
  // timestamp window is enforced independently of the signature.
  it("rejects a replayed delivery outside the tolerance window", async () => {
    const signature = await sign("msg_1", timestamp, body);
    const result = await verifyWebhookSignature({
      secret: SECRET,
      body,
      headers: { id: "msg_1", timestamp, signature },
      now: now + 60 * 60 * 1000,
    });
    expect(result).toEqual({ valid: false, reason: "timestamp_out_of_tolerance" });
  });

  it("rejects a signature bound to a different message id", async () => {
    const signature = await sign("msg_other", timestamp, body);
    const result = await verifyWebhookSignature({
      secret: SECRET,
      body,
      headers: { id: "msg_1", timestamp, signature },
      now,
    });
    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("requires all three Svix headers", async () => {
    const result = await verifyWebhookSignature({
      secret: SECRET,
      body,
      headers: { id: "msg_1", timestamp, signature: null },
      now,
    });
    expect(result).toEqual({ valid: false, reason: "missing_headers" });
  });

  // Svix sends multiple v1 entries during secret rotation; any match passes.
  it("accepts when one of several offered signatures matches", async () => {
    const good = await sign("msg_1", timestamp, body);
    const result = await verifyWebhookSignature({
      secret: SECRET,
      body,
      headers: { id: "msg_1", timestamp, signature: `v1,AAAA ${good}` },
      now,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a non-numeric timestamp instead of treating it as now", async () => {
    const signature = await sign("msg_1", "not-a-number", body);
    const result = await verifyWebhookSignature({
      secret: SECRET,
      body,
      headers: { id: "msg_1", timestamp: "not-a-number", signature },
      now,
    });
    expect(result).toEqual({ valid: false, reason: "invalid_timestamp" });
  });
});
