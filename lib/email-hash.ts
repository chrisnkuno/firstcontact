import { normalizeEmail } from "./compliance";

/**
 * Stable hash of an email address, used as the suppression-list key.
 *
 * Normalizing before hashing matters: `Team@Example.com ` and
 * `team@example.com` are the same mailbox, and a suppression that only matched
 * the exact casing of the bounce event would let the next send through.
 *
 * This is a plain SHA-256 rather than a salted KDF on purpose. The value has to
 * be *deterministic across processes* to work as a lookup key at send time, and
 * the threat it defends against is a database read yielding a directly usable
 * mailing list — not offline cracking of a known-address guess, which is
 * unpreventable for any deterministic scheme.
 */
export async function hashEmail(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeEmail(email));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
