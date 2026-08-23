/**
 * Participant invite codes.
 *
 * A code is the artifact an operator hands to someone who submitted the join
 * form, so it has to survive being read aloud, copied out of a chat window, or
 * typed from a screenshot. That rules out a raw base64 token and drives every
 * choice here:
 *
 *   - The alphabet omits `I`, `L`, `O`, `U`, `0` and `1`. The first four are
 *     the pairs people transcribe wrongly; `U` is dropped because it turns
 *     accidental words into unfortunate ones.
 *   - Codes are upper-case and hyphen-grouped, and `normaliseInviteCode`
 *     accepts any casing or spacing so a pasted `fc 4h7k2 9mxpq` still matches.
 *
 * Ten characters over this alphabet carries roughly 49 bits. The code is a
 * short-lived bearer setup credential, not a password: it must also match the
 * selected opaque signup id, is never exposed by the public participant list,
 * expires, and becomes unusable after redemption.
 */

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUP = 5;
const GROUPS = 2;

export const INVITE_CODE_PREFIX = "FC";
export const INVITE_CODE_LENGTH = GROUP * GROUPS;

/** Days a freshly issued code stays redeemable. */
export const INVITE_TTL_DAYS = 90;
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Generates a code using the injected randomness source.
 *
 * `randomBytes` is a parameter rather than a direct `crypto.getRandomValues`
 * call so tests can pin an exact output without stubbing a global. Production
 * callers pass Web Crypto, which both the Convex runtime and Node 22 provide.
 */
export function generateInviteCode(randomBytes: (length: number) => Uint8Array): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    // Modulo bias across the alphabet over 256 values is small and does not
    // the six most likely symbols. It is not cryptographically ideal, and it
    // materially change the online guessing resistance of this setup token.
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i += 1) {
    groups.push(out.slice(i * GROUP, (i + 1) * GROUP));
  }
  return [INVITE_CODE_PREFIX, ...groups].join("-");
}

/** Web Crypto randomness, for callers that are not tests. */
export function cryptoRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Canonical form for comparison and storage.
 *
 * Returns null when the input cannot be a code at all, so callers can reject
 * malformed input before touching the database.
 */
export function normaliseInviteCode(input: string): string | null {
  const stripped = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!stripped.startsWith(INVITE_CODE_PREFIX)) return null;
  const body = stripped.slice(INVITE_CODE_PREFIX.length);
  if (body.length !== INVITE_CODE_LENGTH) return null;
  for (const character of body) {
    if (!ALPHABET.includes(character)) return null;
  }
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i += 1) {
    groups.push(body.slice(i * GROUP, (i + 1) * GROUP));
  }
  return [INVITE_CODE_PREFIX, ...groups].join("-");
}
