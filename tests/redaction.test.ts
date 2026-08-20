import { describe, expect, it } from "vitest";
import { MAX_REDACTED_LENGTH, fingerprint, normalizeRoute, redact } from "../lib/redaction";

/**
 * Redaction is a privacy control, not a formatting nicety: it runs before an
 * error is stored, so anything it misses is persisted. These tests are written
 * as "this specific thing must never survive" rather than as snapshots.
 */
describe("redact", () => {
  it("removes email addresses, including tagged ones", () => {
    expect(redact("failed for founder@example.org")).not.toContain("founder@example.org");
    expect(redact("failed for founder+vc@example.co.uk")).not.toContain("founder+vc");
  });

  it("removes JWTs and bearer credentials", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    expect(redact(`token ${jwt} rejected`)).not.toContain(jwt);
    expect(redact("Authorization: Bearer abc123def456ghi")).not.toContain("abc123def456ghi");
    expect(redact("api_key=sk-live-0123456789abcdef")).not.toContain("0123456789abcdef");
  });

  it("removes query strings, where identifiers usually end up in a URL", () => {
    const redacted = redact("GET /investor?email=a@b.com&token=xyz failed");
    expect(redacted).not.toContain("a@b.com");
    expect(redacted).not.toContain("xyz");
  });

  it("removes long digit runs and one-time codes", () => {
    expect(redact("card 4111 1111 1111 1111")).not.toContain("4111");
    expect(redact("code 1234 5678 did not match")).not.toContain("1234 5678");
  });

  it("never throws, whatever it is handed", () => {
    expect(redact(undefined)).toBeTruthy();
    expect(redact(null)).toBeTruthy();
    expect(redact({ toString() { throw new Error("hostile"); } })).toBeTruthy();
  });

  it("caps length so one runaway message cannot fill the table", () => {
    const redacted = redact("x".repeat(5000));
    expect(redacted.length).toBeLessThanOrEqual(MAX_REDACTED_LENGTH + 20);
  });

  it("leaves an ordinary diagnostic readable", () => {
    expect(redact("TypeError: cannot read property 'listing' of undefined")).toContain("TypeError");
  });
});

describe("fingerprint", () => {
  // Otherwise the error table becomes a log: the same bug at two line numbers
  // would occupy two rows and neither would show its true frequency.
  it("groups the same bug across volatile detail", () => {
    const a = fingerprint("client", "Cannot read 'x' of undefined at line 41", "/dashboard");
    const b = fingerprint("client", "Cannot read 'y' of undefined at line 52", "/dashboard");
    expect(a).toBe(b);
  });

  it("keeps genuinely different failures apart", () => {
    const a = fingerprint("client", "Cannot read property of undefined", "/dashboard");
    const b = fingerprint("client", "Network request failed", "/dashboard");
    expect(a).not.toBe(b);
  });

  it("separates the same message on different routes and sources", () => {
    expect(fingerprint("client", "boom", "/a")).not.toBe(fingerprint("client", "boom", "/b"));
    expect(fingerprint("client", "boom", "/a")).not.toBe(fingerprint("convex", "boom", "/a"));
  });

  it("cannot carry personal data into the fingerprint", () => {
    expect(fingerprint("client", "failed for founder@example.org", "/x")).not.toContain("example.org");
  });
});

describe("normalizeRoute", () => {
  it("collapses opaque and numeric segments", () => {
    expect(normalizeRoute("/investor/k17abc9defghijklmnop")).toBe("/investor/:id");
    expect(normalizeRoute("/listing/12345")).toBe("/listing/:id");
  });

  it("drops query and fragment", () => {
    expect(normalizeRoute("/dashboard?email=a@b.com#top")).toBe("/dashboard");
  });

  it("refuses anything that is not a path", () => {
    expect(normalizeRoute("https://evil.example/x")).toBe("-");
    expect(normalizeRoute(undefined)).toBe("-");
  });
});
