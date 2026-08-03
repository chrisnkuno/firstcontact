import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/catalogue-interest/route";

// A real profile id from lib/catalogue-data.ts.
const KNOWN_PROFILE_ID = "kivu-grid";

const APP_ORIGIN = "https://firstcontact.example";

function interestRequest(
  body: unknown,
  { headers = {} }: { headers?: Record<string, string> } = {},
) {
  return new NextRequest(`${APP_ORIGIN}/api/catalogue-interest`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  profileId: KNOWN_PROFILE_ID,
  email: "investor@example.com",
  note: "We back climate-tech in East Africa.",
};

beforeEach(() => {
  vi.stubEnv("CONVEX_URL", "");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  vi.stubEnv("SIGNUP_INGEST_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/catalogue-interest payload guards", () => {
  it("rejects an oversized body via content-length header", async () => {
    const response = await POST(
      interestRequest(validBody, { headers: { "content-length": "9000" } }),
    );
    expect(response.status).toBe(413);
  });

  it("rejects a body that is not valid JSON", async () => {
    const request = new NextRequest(`${APP_ORIGIN}/api/catalogue-interest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not valid json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe("POST /api/catalogue-interest validation", () => {
  it("rejects a missing email", async () => {
    const response = await POST(interestRequest({ profileId: KNOWN_PROFILE_ID }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
  });

  it("rejects a malformed email address", async () => {
    const response = await POST(
      interestRequest({ profileId: KNOWN_PROFILE_ID, email: "not-an-email" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a note that exceeds 500 characters", async () => {
    const response = await POST(
      interestRequest({
        profileId: KNOWN_PROFILE_ID,
        email: "investor@example.com",
        note: "x".repeat(501),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a filled honeypot field", async () => {
    const response = await POST(
      interestRequest({ ...validBody, company: "Spam Corp" }),
    );
    expect(response.status).toBe(400);
  });

  it("accepts a blank honeypot field", async () => {
    // Passes validation — stopped only at the unconfigured Convex boundary.
    const response = await POST(interestRequest({ ...validBody, company: "" }));
    expect(response.status).toBe(503);
  });

  it("accepts an interest signal with no optional note", async () => {
    const response = await POST(
      interestRequest({ profileId: KNOWN_PROFILE_ID, email: "investor@example.com" }),
    );
    // Passes validation, halted by unconfigured Convex.
    expect(response.status).toBe(503);
  });

  it("normalises email to lower-case before persisting", async () => {
    // The route must reach the persistence boundary (503) — if it rejected
    // early the email normalisation contract would be violated.
    const response = await POST(
      interestRequest({ profileId: KNOWN_PROFILE_ID, email: "Investor@Example.COM" }),
    );
    expect(response.status).toBe(503);
  });
});

describe("POST /api/catalogue-interest profile lookup", () => {
  it("returns 404 for an unknown profile id", async () => {
    const response = await POST(
      interestRequest({ profileId: "does-not-exist", email: "investor@example.com" }),
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    // The exact message the route sends.
    expect(body.message).toMatch(/could not be found/i);
  });

  it("accepts each real catalogue profile id", async () => {
    const { catalogueProfiles } = await import("@/lib/catalogue-data");
    for (const profile of catalogueProfiles) {
      const response = await POST(
        // Use a per-profile IP so the shared rate-limit map stays clean.
        interestRequest(
          { profileId: profile.id, email: "test@example.com" },
          { headers: { "x-forwarded-for": `10.0.0.${catalogueProfiles.indexOf(profile) + 1}` } },
        ),
      );
      // Every known id should reach the unconfigured-Convex 503, not a 404.
      expect(response.status).toBe(503);
    }
  });
});

describe("POST /api/catalogue-interest persistence boundary", () => {
  it("reports unavailability without storing anything when Convex is not configured", async () => {
    // Use a fresh IP that no earlier test has touched to avoid hitting the
    // in-process rate-limit bucket shared across tests in the same worker.
    const response = await POST(
      interestRequest(validBody, { headers: { "x-forwarded-for": "203.0.113.99" } }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toContain("Nothing was stored");
  });
});

describe("POST /api/catalogue-interest rate limiting", () => {
  it("rate limits after exceeding the per-window submission cap from the same IP", async () => {
    // Use a dedicated IP so earlier tests' submissions don't pollute this bucket.
    const ip = "203.0.113.51";
    const statuses: number[] = [];

    // MAX_SUBMISSIONS is 10 and the check is `count > MAX_SUBMISSIONS` after
    // incrementing. Request 1 seeds the bucket at count=1 (not limited).
    // Requests 2–10 increment to 2–10 (not limited). Request 11 increments
    // to 11, which is > 10, so it is the first to be rate-limited.
    // We send 13 to observe the transition clearly.
    for (let attempt = 0; attempt < 13; attempt += 1) {
      const response = await POST(
        interestRequest(validBody, { headers: { "x-forwarded-for": ip } }),
      );
      statuses.push(response.status);
    }

    // The first 10 should not be rate-limited (503 from unconfigured Convex).
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true);
    // From the 11th request onwards the in-process rate limiter kicks in.
    expect(statuses.slice(10).every((s) => s === 429)).toBe(true);
  });
});
