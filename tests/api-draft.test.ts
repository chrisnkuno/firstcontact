import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/draft/route";

// Same class-based mock approach as api-translate.test.ts.
const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      responses = { create: mockCreate };
    },
  };
});

const validInput = {
  founder: {
    name: "Amara Okafor",
    organization: "Sokoni Logistics",
    oneLiner: "Cold-chain logistics for smallholder cooperatives.",
    traction: "40 recurring cooperative customers with zero external capital.",
    context: "Built on ten years of last-mile infrastructure experience in East Africa.",
  },
  investor: {
    firm: "Horizon Capital",
    thesis: "Early-stage climate and logistics in frontier markets.",
    evidence: [
      "Horizon backed CoolPort in 2023, focusing on cold-chain infrastructure.",
      "Partner Maria Chen has spoken publicly about African agri-logistics.",
    ],
    sourceUrl: "https://horizoncapital.example/portfolio",
  },
};

function draftRequest(body: unknown) {
  return new Request("http://localhost/api/draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "");
  mockCreate.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/draft input validation", () => {
  it("rejects an empty body with 400", async () => {
    const response = await POST(draftRequest({}));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it("rejects a missing founder block", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { founder: _f, ...noFounder } = validInput;
    const response = await POST(draftRequest(noFounder));
    expect(response.status).toBe(400);
  });

  it("rejects a missing investor block", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { investor: _i, ...noInvestor } = validInput;
    const response = await POST(draftRequest(noInvestor));
    expect(response.status).toBe(400);
  });

  it("rejects an investor block with a non-URL sourceUrl", async () => {
    const response = await POST(
      draftRequest({
        ...validInput,
        investor: { ...validInput.investor, sourceUrl: "not-a-url" },
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/draft preview mode (no OPENAI_API_KEY)", () => {
  it("returns mode=preview with a non-fabricated placeholder when no API key is set", async () => {
    const response = await POST(draftRequest(validInput));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      mode: string;
      draft: { subject: string; body: string; claimsToVerify: unknown[] };
    };
    expect(body.mode).toBe("preview");
    // The preview subject must include the org and investor firm names.
    expect(body.draft.subject).toContain("Sokoni Logistics");
    expect(body.draft.subject).toContain("Horizon Capital");
    // The preview body must not invent investor-specific facts.
    expect(body.draft.body).not.toMatch(/raised|funded|portfolio company of Horizon/i);
    // claimsToVerify list should be present (can be empty in preview).
    expect(Array.isArray(body.draft.claimsToVerify)).toBe(true);
  });

  it("does not set requiresHumanApproval in preview mode", async () => {
    const response = await POST(draftRequest(validInput));
    const body = (await response.json()) as Record<string, unknown>;
    // Live mode sets requiresHumanApproval: true; preview mode omits the flag.
    expect(body.requiresHumanApproval).toBeUndefined();
  });
});

describe("POST /api/draft live mode (OPENAI_API_KEY configured)", () => {
  it("returns mode=live with requiresHumanApproval=true and the OpenAI draft", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-fake-key");

    const fakeDraft = {
      subject: "Sokoni Logistics × Horizon Capital",
      body: "Dear Maria, Amara here from Sokoni Logistics.",
      claimsToVerify: ["CoolPort portfolio reference"],
    };

    mockCreate.mockResolvedValue({
      output_text: JSON.stringify(fakeDraft),
    });

    const response = await POST(draftRequest(validInput));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      mode: string;
      draft: typeof fakeDraft;
      requiresHumanApproval: boolean;
    };
    expect(body.mode).toBe("live");
    expect(body.requiresHumanApproval).toBe(true);
    expect(body.draft.subject).toBe(fakeDraft.subject);
    expect(body.draft.claimsToVerify).toEqual(fakeDraft.claimsToVerify);
  });

  it("returns 502 when OpenAI throws", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-fake-key");

    mockCreate.mockRejectedValue(new Error("rate limit"));

    const response = await POST(draftRequest(validInput));
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/provider/i);
  });
});
