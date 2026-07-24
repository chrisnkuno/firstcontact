import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/login/route";

const APP_ORIGIN = "https://firstcontact.example";

function loginRequest(
  body: unknown,
  { headers = {}, rawBody }: { headers?: Record<string, string>; rawBody?: string } = {},
) {
  return new NextRequest(`${APP_ORIGIN}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_ORIGIN, ...headers },
    body: rawBody ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_ORIGIN);
  vi.stubEnv("CONVEX_URL", "");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  vi.stubEnv("ADMIN_ACTION_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/admin/login request guards", () => {
  it("rejects cross-site and foreign-origin sign-in attempts", async () => {
    const crossSite = await POST(
      loginRequest({ email: "a@b.com", password: "x" }, { headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(crossSite.status).toBe(403);

    const foreign = await POST(
      loginRequest({ email: "a@b.com", password: "x" }, { headers: { origin: "https://attacker.example" } }),
    );
    expect(foreign.status).toBe(403);
  });

  it("requires JSON and rejects an oversized body before parsing it", async () => {
    expect(
      (await POST(loginRequest({ email: "a@b.com", password: "x" }, { headers: { "content-type": "text/plain" } })))
        .status,
    ).toBe(415);

    const huge = await POST(loginRequest({ email: "a@b.com", password: "x".repeat(5_000) }));
    expect(huge.status).toBe(413);
  });

  it("rejects a body that is not valid JSON", async () => {
    expect((await POST(loginRequest(null, { rawBody: "{{" }))).status).toBe(400);
  });
});

describe("POST /api/admin/login credential handling", () => {
  it("never reveals whether an account exists", async () => {
    // A malformed email and a well-formed unknown one must be indistinguishable
    // in wording — anything else is a user-enumeration oracle.
    const malformed = await POST(loginRequest({ email: "not-an-email", password: "hunter2" }));
    expect(malformed.status).toBe(400);
    const malformedBody = (await malformed.json()) as { message: string };
    expect(malformedBody.message).toBe("Invalid email or password.");
    expect(malformedBody.message).not.toMatch(/email address|not found|no account|password is/i);
  });

  it("refuses to sign anyone in when admin auth is not configured", async () => {
    const response = await POST(loginRequest({ email: "admin@firstcontact.example", password: "hunter2" }));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
    // Critically: not a 200, and no session cookie handed out.
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("never sets a session cookie on any failure path", async () => {
    const failures = await Promise.all([
      POST(loginRequest({ email: "a@b.com", password: "x" }, { headers: { "sec-fetch-site": "cross-site" } })),
      POST(loginRequest({ email: "bad", password: "x" })),
      POST(loginRequest(null, { rawBody: "{{" })),
      POST(loginRequest({ email: "admin@firstcontact.example", password: "hunter2" })),
    ]);
    for (const response of failures) {
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.status).not.toBe(200);
    }
  });
});
