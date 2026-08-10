/**
 * Opaque limiter keys.
 *
 * The limiter table is keyed by an HMAC of the client address rather than the
 * address itself, so the rate-limit records are not a log of who visited. The
 * HMAC (not a bare hash) matters because the input space of IPv4 is small
 * enough to enumerate exhaustively — without a secret, a leaked table would be
 * trivially reversible.
 *
 * Web Crypto rather than `node:crypto`: these now run inside a Convex HTTP
 * action, not a Next.js route.
 */
export type RateLimitKeys = { addressKey: string; addressEmailKey: string };

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function signupRateLimitKeys({
  address,
  email,
  secret,
}: {
  address: string;
  email: string;
  secret: string;
}): Promise<RateLimitKeys> {
  const normalizedAddress = address.trim() || "unknown";
  const normalizedEmail = email.trim().toLowerCase();

  const [addressKey, addressEmailKey] = await Promise.all([
    hmacHex(secret, `signup:address:${normalizedAddress}`),
    hmacHex(secret, `signup:address-email:${normalizedAddress}:${normalizedEmail}`),
  ]);
  return { addressKey, addressEmailKey };
}

export async function catalogueRateLimitKeys({
  address,
  email,
  secret,
}: {
  address: string;
  email: string;
  secret: string;
}): Promise<RateLimitKeys> {
  const normalizedAddress = address.trim() || "unknown";
  const normalizedEmail = email.trim().toLowerCase();

  const [addressKey, addressEmailKey] = await Promise.all([
    hmacHex(secret, `catalogue:address:${normalizedAddress}`),
    hmacHex(secret, `catalogue:address-email:${normalizedAddress}:${normalizedEmail}`),
  ]);
  return { addressKey, addressEmailKey };
}

/**
 * Best-effort client address from proxy headers.
 *
 * `x-forwarded-for` is a client-controllable header in general, but Convex's
 * edge prepends the real peer address, so the *first* entry is trustworthy and
 * any values an attacker appended are not. Taking the first entry — never the
 * last — is what makes this usable as a limiter key.
 */
export function clientAddressFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("cf-connecting-ip")?.trim() || "unknown";
}
