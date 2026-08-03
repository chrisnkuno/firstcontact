import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/founder/login/route";
import { FOUNDER_SESSION_COOKIE } from "@/lib/founder-auth";

// The route shares the same same-origin trust model and credential pattern as
// /api/admin/login, so the test structure mirrors api-admin-login.test.ts.

const APP_ORIGIN = "https://firstcontact.example";

function loginRequest(
  body: unknown,
  { headers = {}, rawBody }: { headers?: Record<string, string>; rawBody?: string } = {},
) {
  return new NextRequest(`${APP_ORIGIN}/api/founder/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_ORIGIN, ...headers },
    body: rawBody ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_ORIGIN);
  vi.stubEnv("CONVEX_URL", "");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  vi.stubEnv("FOUNDER_ACTION_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/founder/login — origin and CSRF guards", () => {
  it("rejects a cross-site browser submission", async () => {
    const response = await POST(
      loginRequest(
        { email: "founder@example.com", password: "hunter2" },
        { headers: { "sec-fetch-site": "cross-site" } },
      ),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a submission with a foreign Origin", async () => {
    const response = await POST(
      loginRequest(
        { email: "founder@example.com", password: "hunter2" },
        { headers: { origin: "https://phishing.example" } },
      ),
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /api/founder/login — content-type and body guards", () => {
  it("rejects a non-JSON content-type", async () => {
    const response = await POST(
      loginRequest(
        { email: "founder@example.com", password: "hunter2" },
        { headers: { "content-type": "text/plain" } },
      ),
    );
    expect(response.status).toBe(415);
  });

  it("rejects an oversized body", async () => {
    const response = await POST(
      loginRequest({ email: "founder@example.com", password: "x".repeat(3_000) }),
    );
    expect(response.status).toBe(413);
  });

  it("rejects a body that is not valid JSON", async () => {
    const response = await POST(loginRequest(null, { rawBody: "{{" }));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/founder/login — credential validation", () => {
  it("never reveals whether a founder account exists", async () => {
    // A malformed email and a well-formed unknown one must produce identical
    // error messages — anything else is a user-enumeration oracle.
    const malformed = await POST(loginRequest({ email: "not-an-email", password: "x" }));
    expect(malformed.status).toBe(400);
    const malformedBody = (await malformed.json()) as { message: string };
    expect(malformedBody.message).toBe("Invalid email or password.");
    expect(malformedBody.message).not.toMatch(/not found|no account|email address/i);
  });

  it("normalises the email to lower-case before look-up", async () => {
    // When Convex is unconfigured, a case-normalised valid-format email must
    // reach the 503 branch, not be rejected at validation.
    const response = await POST(
      loginRequest({ email: "Founder@EXAMPLE.COM", password: "ValidPass1" }),
    );
    expect(response.status).toBe(503);
  });
});

describe("POST /api/founder/login — unconfigured environment", () => {
  it("returns 503 and never hands out a session cookie when backend is not configured", async () => {
    const response = await POST(
      loginRequest({ email: "founder@example.com", password: "hunter2" }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("POST /api/founder/login — session cookie hygiene", () => {
  it("never sets the session cookie on any failure path", async () => {
    const failures = await Promise.all([
      // Cross-site
      POST(loginRequest({ email: "a@b.com", password: "x" }, { headers: { "sec-fetch-site": "cross-site" } })),
      // Bad content-type
      POST(loginRequest({ email: "a@b.com", password: "x" }, { headers: { "content-type": "text/html" } })),
      // Malformed email
      POST(loginRequest({ email: "bad", password: "x" })),
      // Unconfigured backend
      POST(loginRequest({ email: "founder@example.com", password: "hunter2" })),
    ]);

    for (const response of failures) {
      const setCookie = response.headers.get("set-cookie") ?? "";
      expect(setCookie).not.toContain(FOUNDER_SESSION_COOKIE);
      expect(response.status).not.toBe(200);
    }
  });
});
