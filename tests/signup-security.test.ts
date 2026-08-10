import { describe, expect, it } from "vitest";
import { isTrustedSubmissionOrigin } from "@/lib/signup-security";
import { signupRateLimitKeys, clientAddressFromHeaders } from "@/lib/rate-limit-keys";

const allowedOrigins = ["https://firstcontact.example"];

describe("submission origin allowlist", () => {
  it("accepts an allowlisted origin", () => {
    expect(
      isTrustedSubmissionOrigin({ allowedOrigins, origin: "https://firstcontact.example" }),
    ).toBe(true);
  });

  it("rejects an origin that is not on the allowlist", () => {
    expect(isTrustedSubmissionOrigin({ allowedOrigins, origin: "https://attacker.example" })).toBe(
      false,
    );
  });

  it("compares canonical origins, ignoring path and trailing slash", () => {
    expect(
      isTrustedSubmissionOrigin({
        allowedOrigins: ["https://firstcontact.example/"],
        origin: "https://firstcontact.example",
      }),
    ).toBe(true);
  });

  it("rejects a malformed Origin header rather than trusting it", () => {
    expect(isTrustedSubmissionOrigin({ allowedOrigins, origin: "not-a-url" })).toBe(false);
  });

  // Browsers always send Origin on cross-origin POSTs, so its absence means a
  // non-browser client. Those are bounded by rate limiting, not by this check.
  it("allows non-browser clients that send no Origin header", () => {
    expect(isTrustedSubmissionOrigin({ allowedOrigins, origin: null })).toBe(true);
  });
});

describe("rate limit keys", () => {
  it("creates stable, scoped, non-plaintext keys", async () => {
    const first = await signupRateLimitKeys({
      address: "203.0.113.10",
      email: "Founder@Example.org",
      secret: "test-limiter-secret",
    });
    const repeated = await signupRateLimitKeys({
      address: "203.0.113.10",
      email: "founder@example.org",
      secret: "test-limiter-secret",
    });

    expect(first).toEqual(repeated);
    expect(first.addressKey).not.toContain("203.0.113.10");
    expect(first.addressEmailKey).not.toContain("founder@example.org");
    expect(first.addressKey).not.toBe(first.addressEmailKey);
  });

  it("changes completely when the secret changes", async () => {
    const withSecretA = await signupRateLimitKeys({
      address: "203.0.113.10",
      email: "founder@example.org",
      secret: "secret-a",
    });
    const withSecretB = await signupRateLimitKeys({
      address: "203.0.113.10",
      email: "founder@example.org",
      secret: "secret-b",
    });
    expect(withSecretA.addressKey).not.toBe(withSecretB.addressKey);
  });
});

describe("client address extraction", () => {
  // Convex's edge prepends the real peer address, so the FIRST entry is the
  // trustworthy one. Taking the last would let a caller choose its own key.
  it("takes the first x-forwarded-for entry, not the last", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10, 198.51.100.7, 10.0.0.1" });
    expect(clientAddressFromHeaders(headers)).toBe("203.0.113.10");
  });

  it("falls back to a constant when no address header is present", () => {
    expect(clientAddressFromHeaders(new Headers())).toBe("unknown");
  });
});
