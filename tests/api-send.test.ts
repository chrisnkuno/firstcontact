import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/send/route";

// The project's central safety claim is that nothing leaves the system without
// an operator flag, a human approval, an auditable source, and a clean
// suppression check. lib/compliance.ts is unit-tested on its own; this suite
// covers the part that actually matters in production — that the HTTP route
// consults it, and does so *before* it ever constructs a provider client.

const OPERATOR_TOKEN = "operator-token-used-only-in-tests";

// A payload with every gate satisfied. Individual tests break one field at a
// time so a failure names the specific gate that stopped enforcing.
const approvedPayload = {
  to: "partners@fund.example",
  subject: "Introduction from a Nairobi climate-logistics founder",
  text: "We are raising a seed round and believe your published thesis on African logistics is a close fit.",
  approved: true as const,
  sourceUrl: "https://fund.example/team",
  contactType: "generic_business" as const,
  jurisdictionReviewed: true,
  isSuppressed: false,
  unsubscribeUrl: "https://firstcontact.example/unsubscribe/abc123",
  senderPostalAddress: "12 Riverside Drive, Nairobi, Kenya",
  idempotencyKey: "idempotency-key-0123456789",
};

function sendRequest(body: unknown, token: string | null = OPERATOR_TOKEN) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request("https://firstcontact.example/api/send", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("OUTBOUND_API_TOKEN", OPERATOR_TOKEN);
  // Every test starts from the shipped default: outbound disabled, no provider.
  vi.stubEnv("OUTBOUND_EMAIL_ENABLED", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("RESEND_FROM", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/send authorization", () => {
  it("rejects a request with no operator token", async () => {
    const response = await POST(sendRequest(approvedPayload, null));
    expect(response.status).toBe(401);
  });

  it("rejects a wrong operator token, including one that is a prefix of the real one", async () => {
    expect((await POST(sendRequest(approvedPayload, "wrong-token"))).status).toBe(401);
    expect((await POST(sendRequest(approvedPayload, OPERATOR_TOKEN.slice(0, -1)))).status).toBe(401);
    expect((await POST(sendRequest(approvedPayload, `${OPERATOR_TOKEN}x`))).status).toBe(401);
  });

  it("refuses to send when no operator token is configured at all", async () => {
    vi.stubEnv("OUTBOUND_API_TOKEN", "");
    const response = await POST(sendRequest(approvedPayload, "anything"));
    expect(response.status).toBe(401);
  });
});

describe("POST /api/send request validation", () => {
  it("rejects a payload whose approved flag is not literally true", async () => {
    for (const approved of [false, "true", 1, null, undefined]) {
      const response = await POST(sendRequest({ ...approvedPayload, approved }));
      expect(response.status).toBe(400);
    }
  });

  it("rejects a non-URL source, a bad recipient, and a too-short idempotency key", async () => {
    const cases = [
      { sourceUrl: "not-a-url" },
      { to: "not-an-email" },
      { idempotencyKey: "short" },
      { senderPostalAddress: "x" },
      { unsubscribeUrl: "" },
    ];
    for (const override of cases) {
      const response = await POST(sendRequest({ ...approvedPayload, ...override }));
      expect(response.status, JSON.stringify(override)).toBe(400);
    }
  });
});

describe("POST /api/send policy enforcement", () => {
  it("blocks a fully valid, human-approved message while the operator flag is off", async () => {
    const response = await POST(sendRequest(approvedPayload));
    expect(response.status).toBe(403);
    const body = (await response.json()) as { reasons: string[] };
    expect(body.reasons).toContain("Live outbound is disabled by the operator");
  });

  it("blocks a suppressed recipient even with outbound enabled", async () => {
    vi.stubEnv("OUTBOUND_EMAIL_ENABLED", "true");
    const response = await POST(sendRequest({ ...approvedPayload, isSuppressed: true }));
    expect(response.status).toBe(403);
    const body = (await response.json()) as { reasons: string[] };
    expect(body.reasons).toContain("The recipient is on the suppression list");
  });

  it("blocks an unresolved contact type, and named personal data without a jurisdiction review", async () => {
    vi.stubEnv("OUTBOUND_EMAIL_ENABLED", "true");

    const unknown = await POST(sendRequest({ ...approvedPayload, contactType: "unknown" }));
    expect(unknown.status).toBe(403);
    expect(((await unknown.json()) as { reasons: string[] }).reasons).toContain(
      "The recipient type is unresolved",
    );

    const named = await POST(
      sendRequest({ ...approvedPayload, contactType: "named_business", jurisdictionReviewed: false }),
    );
    expect(named.status).toBe(403);
    expect(((await named.json()) as { reasons: string[] }).reasons).toContain(
      "Named personal data requires a jurisdiction and lawful-basis review",
    );
  });

  it("reports every failing gate at once rather than only the first", async () => {
    const response = await POST(sendRequest({ ...approvedPayload, isSuppressed: true, contactType: "unknown" }));
    const body = (await response.json()) as { reasons: string[] };
    expect(body.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it("only reaches the provider once every gate passes — and still fails closed when Resend is unconfigured", async () => {
    vi.stubEnv("OUTBOUND_EMAIL_ENABLED", "true");
    const response = await POST(sendRequest(approvedPayload));
    // 503, not 403: policy passed, so the route advanced to the provider check.
    // Reaching this status is what proves the ordering — policy is evaluated
    // before any Resend client is constructed or any network call is made.
    expect(response.status).toBe(503);
    expect((await response.json()) as { error: string }).toEqual({ error: "Resend is not configured" });
  });
});
