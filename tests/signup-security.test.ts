import { describe, expect, it } from "vitest";
import {
  isTrustedSignupRequest,
  signupRateLimitKeys,
} from "@/lib/signup-security";

describe("signup request security", () => {
  it("accepts the deployed origin and rejects cross-site browser posts", () => {
    expect(
      isTrustedSignupRequest({
        configuredOrigin: "https://firstcontact.example",
        origin: "https://firstcontact.example",
        requestOrigin: "https://deployment.example",
        secFetchSite: "same-origin",
      }),
    ).toBe(true);

    expect(
      isTrustedSignupRequest({
        configuredOrigin: "https://firstcontact.example",
        origin: "https://attacker.example",
        requestOrigin: "https://firstcontact.example",
        secFetchSite: "cross-site",
      }),
    ).toBe(false);
  });

  it("allows non-browser clients without an Origin header", () => {
    expect(
      isTrustedSignupRequest({
        origin: null,
        requestOrigin: "https://firstcontact.example",
        secFetchSite: null,
      }),
    ).toBe(true);
  });

  it("creates stable, scoped, non-plaintext rate-limit keys", () => {
    const first = signupRateLimitKeys({
      address: "203.0.113.10",
      email: "Founder@Example.org",
      secret: "test-ingestion-secret",
    });
    const repeated = signupRateLimitKeys({
      address: "203.0.113.10",
      email: "founder@example.org",
      secret: "test-ingestion-secret",
    });

    expect(first).toEqual(repeated);
    expect(first.addressKey).not.toContain("203.0.113.10");
    expect(first.addressEmailKey).not.toContain("founder@example.org");
    expect(first.addressKey).not.toBe(first.addressEmailKey);
  });
});
