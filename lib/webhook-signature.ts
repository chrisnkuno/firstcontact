/**
 * Svix (Resend) webhook signature verification, on Web Crypto.
 *
 * This replaces the `svix` npm package because verification now happens inside
 * a Convex `httpAction`, which runs in the V8 runtime where `node:crypto` is
 * unavailable. The scheme is small and fully specified, so reimplementing it
 * costs less than routing every webhook through a separate Node action purely
 * to borrow one HMAC.
 *
 * The signed payload is `{id}.{timestamp}.{body}`, HMAC-SHA256 under the
 * base64-decoded portion of a `whsec_`-prefixed secret. The `svix-signature`
 * header carries a space-separated list of `v1,<base64>` entries — a list,
 * because Svix supports overlapping secrets during rotation, so *any* match is
 * a pass.
 */

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

export type WebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export type VerificationResult = { valid: true } | { valid: false; reason: string };

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  // Explicit ArrayBuffer backing so the result satisfies BufferSource.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function verifyWebhookSignature({
  secret,
  body,
  headers,
  now = Date.now(),
  toleranceMs = DEFAULT_TOLERANCE_MS,
}: {
  secret: string;
  body: string;
  headers: WebhookHeaders;
  now?: number;
  toleranceMs?: number;
}): Promise<VerificationResult> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { valid: false, reason: "missing_headers" };

  const sentAtSeconds = Number(timestamp);
  if (!Number.isFinite(sentAtSeconds)) return { valid: false, reason: "invalid_timestamp" };

  // A replayed-but-genuinely-signed delivery is still an attack, so the
  // timestamp window is enforced before the signature is even computed.
  if (Math.abs(now - sentAtSeconds * 1000) > toleranceMs) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }

  const rawSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = base64ToBytes(rawSecret);
  } catch {
    return { valid: false, reason: "malformed_secret" };
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  const expected = bytesToBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, signed)));

  const provided = signature
    .split(" ")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("v1,"))
    .map((entry) => entry.slice("v1,".length));
  if (provided.length === 0) return { valid: false, reason: "no_v1_signature" };

  // Every candidate is compared even after a match so the work done does not
  // depend on which secret in a rotation pair was used.
  let matched = false;
  for (const candidate of provided) {
    if (timingSafeEqualString(candidate, expected)) matched = true;
  }
  return matched ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}
