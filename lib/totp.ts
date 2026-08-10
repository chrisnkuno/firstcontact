// A minimal RFC 4226 (HOTP) / RFC 6238 (TOTP) implementation built on Web
// Crypto — deliberately self-contained rather than an external authenticator
// dependency.
//
// This is Web Crypto rather than `node:crypto` because it now runs inside a
// Convex function, not a Next.js server route: the Convex runtime exposes
// `crypto.subtle` and `crypto.getRandomValues` but not `node:crypto`. The
// tradeoff is that every operation is async, since `subtle.sign` is.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
const SECRET_BYTES = 20; // 160 bits, the RFC 4226 recommended HMAC-SHA1 key size.

export function generateTotpSecret(): string {
  const bytes = new Uint8Array(new ArrayBuffer(SECRET_BYTES));
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");

  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder) {
    const chunk = bits.slice(bits.length - remainder).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

export function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  // Backed by an explicit ArrayBuffer: a plain `Uint8Array.from` is typed over
  // ArrayBufferLike, which Web Crypto's BufferSource does not accept.
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

async function hotp(secret: Uint8Array<ArrayBuffer>, counter: number): Promise<string> {
  const counterBytes = new Uint8Array(new ArrayBuffer(8));
  new DataView(counterBytes.buffer).setBigUint64(0, BigInt(counter));

  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-1" }, false, [
    "sign",
  ]);
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binCode % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export async function totpCode(secretBase32: string, forTime: number = Date.now()): Promise<string> {
  const counter = Math.floor(forTime / 1000 / STEP_SECONDS);
  return hotp(base32Decode(secretBase32), counter);
}

// Allows ±1 step (30s) of clock drift between the server and the
// authenticator app, which is standard TOTP practice.
//
// Every candidate in the drift window is computed before comparing, and the
// comparison itself accumulates differences rather than returning early, so
// the time taken does not depend on how many leading digits an attacker
// guessed correctly.
export async function verifyTotp(
  secretBase32: string,
  token: string,
  forTime: number = Date.now(),
): Promise<boolean> {
  const cleanToken = token.trim();
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const candidates = await Promise.all(
    [-1, 0, 1].map((drift) => totpCode(secretBase32, forTime + drift * STEP_SECONDS * 1000)),
  );
  return candidates.some((candidate) => timingSafeEqualString(candidate, cleanToken));
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function buildOtpauthUri({ secret, email, issuer }: { secret: string; email: string; issuer: string }): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
