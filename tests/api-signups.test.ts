import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/signups/route";

// Every guard in this route runs before Convex is contacted. With Convex left
// unconfigured, a request that survives all of them lands on a 503 — so "did
// this request get rejected, and by which guard" is fully observable without
// mocking the database.

const APP_ORIGIN = "https://firstcontact.example";

const validSignup = {
  accountType: "startup",
  name: "Amara Okafor",
  email: "Amara@Example.com",
  location: "Nairobi, Kenya",
  organizationName: "Sokoni Logistics",
  stage: "seed",
  summary: "We move refrigerated produce for smallholder cooperatives across three counties.",
  context: "We have grown to 40 recurring cooperative customers without any outside investment so far.",
  goals: ["raise-capital"],
  targetRegions: ["US", "EU"],
  referralSource: "community",
  consentToProcess: true,
  productUpdates: false,
};

function signupRequest(
  body: unknown,
  { headers = {}, rawBody }: { headers?: Record<string, string>; rawBody?: string } = {},
) {
  return new NextRequest(`${APP_ORIGIN}/api/signups`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_ORIGIN, ...headers },
    body: rawBody ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_ORIGIN);
  // Unconfigured on purpose: nothing in this suite should reach persistence.
  vi.stubEnv("CONVEX_URL", "");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  vi.stubEnv("SIGNUP_INGEST_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/signups request trust", () => {
  it("rejects a cross-site browser submission", async () => {
    const response = await POST(
      signupRequest(validSignup, { headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a submission carrying a foreign Origin", async () => {
    const response = await POST(signupRequest(validSignup, { headers: { origin: "https://attacker.example" } }));
    expect(response.status).toBe(403);
  });

  it("accepts a same-origin submission and a non-browser client that sends no Origin", async () => {
    const sameOrigin = await POST(signupRequest(validSignup, { headers: { "sec-fetch-site": "same-origin" } }));
    expect(sameOrigin.status).toBe(503); // passed every guard, stopped at unconfigured Convex

    const noOrigin = new NextRequest(`${APP_ORIGIN}/api/signups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSignup),
    });
    expect((await POST(noOrigin)).status).toBe(503);
  });
});

describe("POST /api/signups payload guards", () => {
  it("requires a JSON content type", async () => {
    const response = await POST(signupRequest(validSignup, { headers: { "content-type": "text/plain" } }));
    expect(response.status).toBe(415);
  });

  it("rejects an oversized body", async () => {
    const oversized = { ...validSignup, context: "x".repeat(40_000) };
    const response = await POST(signupRequest(oversized));
    expect(response.status).toBe(413);
  });

  it("rejects a body that is not valid JSON", async () => {
    const response = await POST(signupRequest(null, { rawBody: "{ not json" }));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/signups validation", () => {
  it("rejects a filled honeypot field", async () => {
    const response = await POST(signupRequest({ ...validSignup, company: "Acme Spam Co" }));
    expect(response.status).toBe(400);
  });

  it("allows a honeypot field that is present but blank", async () => {
    const response = await POST(signupRequest({ ...validSignup, company: "   " }));
    expect(response.status).toBe(503);
  });

  it("requires explicit consent", async () => {
    for (const consentToProcess of [false, undefined, "true"]) {
      const response = await POST(signupRequest({ ...validSignup, consentToProcess }));
      expect(response.status).toBe(400);
    }
  });

  it("names the offending fields in plain language instead of echoing schema internals", async () => {
    const response = await POST(signupRequest({ ...validSignup, email: "nope", name: "" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string; fields: Record<string, string[]> };
    expect(body.message).toContain("your email");
    expect(Object.keys(body.fields)).toEqual(expect.arrayContaining(["email", "name"]));
    expect(body.message).not.toMatch(/zod|invalid_type|ZodError/i);
  });

  it("applies the account-type conditional rules", async () => {
    // A startup must name its organization and stage.
    const noOrg = await POST(signupRequest({ ...validSignup, organizationName: "" }));
    expect(noOrg.status).toBe(400);
    const noStage = await POST(signupRequest({ ...validSignup, stage: undefined }));
    expect(noStage.status).toBe(400);

    // An individual must instead name a role.
    const individual = { ...validSignup, accountType: "individual", organizationName: undefined, stage: undefined };
    expect((await POST(signupRequest(individual))).status).toBe(400);
    expect((await POST(signupRequest({ ...individual, individualRole: "founder" }))).status).toBe(503);
  });
});

describe("POST /api/signups persistence boundary", () => {
  it("reports unavailability without storing anything when Convex is not configured", async () => {
    const response = await POST(signupRequest(validSignup));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toContain("was not stored");
  });
});
