/**
 * Redaction for anything that gets stored or transmitted as diagnostics.
 *
 * An error report is the single most likely place for personal data to leak
 * into a system that was otherwise careful about it: stack traces carry query
 * strings, messages quote the value that failed validation, and "just log the
 * payload" is the most natural debugging instinct there is. So redaction runs
 * *before* storage rather than at display time — a redacted-on-read design
 * still has the raw value sitting in the database, which is exactly what a
 * subject access request or a breach would expose.
 *
 * The rules are deliberately aggressive and lossy. A diagnostic that is 10%
 * less useful is a fine price for one that cannot become a privacy incident.
 */

/** Substituted for anything removed, so a reader can see that redaction happened. */
const MASK = "[redacted]";

/**
 * Ordered because earlier patterns claim text that later ones would otherwise
 * mangle — an email inside a URL should be caught as an email first.
 */
const PATTERNS: { name: string; pattern: RegExp }[] = [
  // Email addresses, including the +tag form.
  { name: "email", pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi },

  // JWTs and Convex Auth tokens: three base64url segments joined by dots.
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },

  // `Bearer <token>` as its own rule, and deliberately *before* the generic
  // key/value rule below. Without it, `Authorization: Bearer abc…` matches the
  // generic rule, which treats the scheme word `Bearer` as the value and
  // leaves the actual token in place — the exact opposite of the intent.
  { name: "bearer", pattern: /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/gi },

  // `token=…`, `api_key: …`, and friends.
  {
    name: "credential",
    pattern:
      /\b(bearer|token|api[_-]?key|secret|password|passwd|pwd|authorization|cookie|session)\b\s*[:=]\s*["']?[^\s"'&,;]{4,}/gi,
  },

  // Vendor key shapes worth catching even when they appear bare.
  { name: "vendor-key", pattern: /\b(sk|pk|rk)[-_](live|test|proj)?[-_]?[A-Za-z0-9]{16,}\b/g },

  // Query strings: almost always where identifiers end up in a URL.
  { name: "query-string", pattern: /\?[^\s"']{1,512}/g },

  // Long digit runs — card numbers, phone numbers, national identifiers.
  { name: "digits", pattern: /\b\d[\d\s-]{8,}\d\b/g },

  // One-time codes of the length this app issues (see convex/authEmail.ts).
  { name: "otp", pattern: /\b\d{4}\s?\d{4}\b/g },
];

/** Diagnostics are capped so a runaway message cannot fill the table. */
export const MAX_REDACTED_LENGTH = 1000;

/**
 * Strips identifying and secret material from a diagnostic string.
 *
 * Always returns a string, including for non-string input, because the callers
 * are error paths and an exception thrown by the redactor would be the worst
 * possible failure mode.
 */
export function redact(value: unknown): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : String(value);
  } catch {
    return MASK;
  }

  for (const { pattern } of PATTERNS) {
    // Fresh lastIndex each pass: these are /g regexes reused across calls.
    pattern.lastIndex = 0;
    text = text.replace(pattern, MASK);
  }

  text = text.trim();
  if (text.length > MAX_REDACTED_LENGTH) {
    text = `${text.slice(0, MAX_REDACTED_LENGTH)}…[truncated]`;
  }
  return text || MASK;
}

/**
 * A stable identity for "the same bug", so repeats increment a counter instead
 * of inserting another row.
 *
 * Built from the redacted message with volatile parts removed — numbers, hex
 * blobs and quoted values — because `Cannot read x of undefined at line 41`
 * and the same thing at line 52 are one bug, and storing them separately turns
 * the error table into a log rather than a list of problems.
 */
export function fingerprint(source: string, message: string, route?: string): string {
  const skeleton = redact(message)
    .toLowerCase()
    .replace(/["'`][^"'`]*["'`]/g, "*")
    .replace(/\b[0-9a-f]{8,}\b/g, "*")
    .replace(/\d+/g, "*")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  return `${source}|${route ?? "-"}|${skeleton}`;
}

/**
 * Normalises a route for grouping: path only, no query, no ids.
 *
 * Numeric and opaque path segments collapse to `:id` so `/investor/abc123` and
 * `/investor/def456` are recognised as the same screen.
 */
export function normalizeRoute(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const path = raw.split("?")[0].split("#")[0].trim();
  if (!path.startsWith("/")) return "-";

  return (
    path
      .split("/")
      .map((segment) =>
        segment.length >= 12 || /^\d+$/.test(segment) || /^[0-9a-f-]{16,}$/i.test(segment)
          ? ":id"
          : segment,
      )
      .join("/")
      .slice(0, 200) || "/"
  );
}
