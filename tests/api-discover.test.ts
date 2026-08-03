import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/discover/route";
import { demoMatches } from "@/lib/demo-data";

// A minimal valid founder profile — mirrors startupProfileSchema in lib/domain.ts.
const validProfile = {
  name: "Sokoni Logistics",
  organizationType: "startup",
  website: "https://sokoni.example",
  location: "Nairobi, Kenya",
  region: "Africa",
  stage: "seed",
  sectors: ["Climate", "Logistics"],
  raiseAmountUsd: 1_500_000,
  oneLiner: "We move refrigerated produce for smallholder cooperatives across three counties.",
  traction: "40 recurring cooperative customers, zero external capital raised so far.",
  impact: "Reduced post-harvest losses by 30% for partner cooperatives in first season.",
  founderContext: "Built by a team with ten years of last-mile cold-chain experience in East Africa.",
  targetRegions: ["US", "EU"],
  consentToProcess: true as const,
};

function discoverRequest(body: unknown) {
  return new Request("http://localhost/api/discover", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("EXA_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/discover input validation", () => {
  it("rejects an empty body with 400", async () => {
    const response = await POST(
      new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it("rejects a missing required field", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...missingName } = validProfile;
    const response = await POST(discoverRequest(missingName));
    expect(response.status).toBe(400);
  });

  it("rejects an invalid region value", async () => {
    const response = await POST(discoverRequest({ ...validProfile, region: "Mars" }));
    expect(response.status).toBe(400);
  });

  it("rejects a negative raiseAmountUsd", async () => {
    const response = await POST(discoverRequest({ ...validProfile, raiseAmountUsd: -1 }));
    expect(response.status).toBe(400);
  });

  it("rejects an empty sectors array", async () => {
    const response = await POST(discoverRequest({ ...validProfile, sectors: [] }));
    expect(response.status).toBe(400);
  });

  it("rejects consentToProcess: false", async () => {
    const response = await POST(discoverRequest({ ...validProfile, consentToProcess: false }));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/discover preview mode (no EXA_API_KEY)", () => {
  it("returns mode=preview with clearly labeled sample data when EXA_API_KEY is not set", async () => {
    const response = await POST(discoverRequest(validProfile));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      mode: string;
      matches: unknown[];
      notice: string;
    };
    expect(body.mode).toBe("preview");
    expect(body.matches).toEqual(demoMatches);
    // The notice must make it clear this is sample data, not live results.
    expect(body.notice).toMatch(/sample/i);
  });
});

describe("POST /api/discover live mode (EXA_API_KEY configured)", () => {
  it("returns mode=live with raw results when Exa responds successfully", async () => {
    vi.stubEnv("EXA_API_KEY", "exa-test-fake-key");

    const fakeResults = [
      { title: "Example VC", url: "https://vc.example", highlights: ["invests in Africa"] },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ requestId: "req-123", results: fakeResults }),
      }),
    );

    const response = await POST(discoverRequest(validProfile));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      mode: string;
      results: unknown[];
      next: string;
    };
    expect(body.mode).toBe("live");
    expect(body.results).toEqual(fakeResults);
    // The "next" hint must remind the caller to normalize before creating contacts.
    expect(body.next).toMatch(/normaliz/i);
  });

  it("returns 502 when the Exa provider returns a non-200 status", async () => {
    vi.stubEnv("EXA_API_KEY", "exa-test-fake-key");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );

    const response = await POST(discoverRequest(validProfile));
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/provider/i);
  });
});
