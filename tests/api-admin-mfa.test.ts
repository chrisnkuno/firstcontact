import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// All three MFA routes share the same same-origin trust check from
// lib/signup-security and the same admin session requirement.  They are
// therefore tested as a group so common guard assertions are not duplicated
// across three files.

const APP_ORIGIN = "https://firstcontact.example";

function mfaRequest(
  path: string,
  body: unknown,
  { headers = {}, cookies = "" }: { headers?: Record<string, string>; cookies?: string } = {},
) {
  return new NextRequest(`${APP_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: APP_ORIGIN,
      ...(cookies ? { cookie: cookies } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// --- helpers for stubbing admin-auth ----------------------------------------

// getAdminSession is called inside the route handlers and reads cookies +
// Convex. We mock the whole module so no real network call is made.
async function stubAdminSession(session: { adminUserId: string; email: string; expiresAt: number } | null) {
  const adminAuth = await import("@/lib/admin-auth");
  vi.spyOn(adminAuth, "getAdminSession").mockResolvedValue(session);
}

// ----------------------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_ORIGIN);
  vi.stubEnv("CONVEX_URL", "");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  vi.stubEnv("ADMIN_ACTION_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ============================================================================
// /api/admin/mfa/setup
// ============================================================================

describe("POST /api/admin/mfa/setup — origin guard", () => {
  it("rejects a cross-site request", async () => {
    const { POST } = await import("@/app/api/admin/mfa/setup/route");
    const response = await POST(
      mfaRequest("/api/admin/mfa/setup", {}, { headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a foreign origin", async () => {
    const { POST } = await import("@/app/api/admin/mfa/setup/route");
    const response = await POST(
      mfaRequest("/api/admin/mfa/setup", {}, { headers: { origin: "https://evil.example" } }),
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /api/admin/mfa/setup — session guard", () => {
  it("returns 401 when there is no active admin session", async () => {
    await stubAdminSession(null);
    const { POST } = await import("@/app/api/admin/mfa/setup/route");
    const response = await POST(mfaRequest("/api/admin/mfa/setup", {}));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });
});

describe("POST /api/admin/mfa/setup — unconfigured environment", () => {
  it("returns 503 when admin backend is not configured", async () => {
    await stubAdminSession({
      adminUserId: "user-1",
      email: "admin@firstcontact.example",
      expiresAt: Date.now() + 3_600_000,
    });
    const { POST } = await import("@/app/api/admin/mfa/setup/route");
    const response = await POST(mfaRequest("/api/admin/mfa/setup", {}));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });
});

// ============================================================================
// /api/admin/mfa/confirm
// ============================================================================

describe("POST /api/admin/mfa/confirm — origin guard", () => {
  it("rejects a cross-site request", async () => {
    const { POST } = await import("@/app/api/admin/mfa/confirm/route");
    const response = await POST(
      mfaRequest("/api/admin/mfa/confirm", { code: "123456" }, { headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /api/admin/mfa/confirm — session guard", () => {
  it("returns 401 when there is no active admin session", async () => {
    await stubAdminSession(null);
    const { POST } = await import("@/app/api/admin/mfa/confirm/route");
    const response = await POST(mfaRequest("/api/admin/mfa/confirm", { code: "123456" }));
    expect(response.status).toBe(401);
  });
});

describe("POST /api/admin/mfa/confirm — code validation", () => {
  it("rejects a code that is not a 6-digit string", async () => {
    await stubAdminSession({
      adminUserId: "user-1",
      email: "admin@firstcontact.example",
      expiresAt: Date.now() + 3_600_000,
    });
    const { POST } = await import("@/app/api/admin/mfa/confirm/route");

    for (const code of ["12345", "1234567", "abcdef", "", 123456]) {
      const response = await POST(mfaRequest("/api/admin/mfa/confirm", { code }));
      expect(response.status).toBe(400);
    }
  });

  it("rejects a malformed request body", async () => {
    await stubAdminSession({
      adminUserId: "user-1",
      email: "admin@firstcontact.example",
      expiresAt: Date.now() + 3_600_000,
    });
    const { POST } = await import("@/app/api/admin/mfa/confirm/route");

    const request = new NextRequest(`${APP_ORIGIN}/api/admin/mfa/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_ORIGIN },
      body: "{{ bad json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 503 when admin backend is not configured (code is valid-shaped)", async () => {
    await stubAdminSession({
      adminUserId: "user-1",
      email: "admin@firstcontact.example",
      expiresAt: Date.now() + 3_600_000,
    });
    const { POST } = await import("@/app/api/admin/mfa/confirm/route");
    const response = await POST(mfaRequest("/api/admin/mfa/confirm", { code: "123456" }));
    // Reaches the Convex check, which is unconfigured.
    expect(response.status).toBe(503);
  });
});

// ============================================================================
// /api/admin/mfa/verify
// ============================================================================

describe("POST /api/admin/mfa/verify — origin guard", () => {
  it("rejects a cross-site request", async () => {
    const { POST } = await import("@/app/api/admin/mfa/verify/route");
    const response = await POST(
      mfaRequest(
        "/api/admin/mfa/verify",
        { code: "123456" },
        { headers: { "sec-fetch-site": "cross-site" } },
      ),
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /api/admin/mfa/verify — challenge cookie requirement", () => {
  it("returns 401 when no MFA challenge cookie is present", async () => {
    const { POST } = await import("@/app/api/admin/mfa/verify/route");
    const response = await POST(
      mfaRequest("/api/admin/mfa/verify", { code: "123456" }),
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toMatch(/sign.?in again/i);
  });
});

describe("POST /api/admin/mfa/verify — code validation", () => {
  it("rejects a code that is not a 6-digit string", async () => {
    const { POST } = await import("@/app/api/admin/mfa/verify/route");
    const { ADMIN_MFA_CHALLENGE_COOKIE } = await import("@/lib/admin-auth");

    for (const code of ["12345", "abcdef", null]) {
      const response = await POST(
        mfaRequest(
          "/api/admin/mfa/verify",
          { code },
          { cookies: `${ADMIN_MFA_CHALLENGE_COOKIE}=fake-challenge-token` },
        ),
      );
      expect(response.status).toBe(400);
    }
  });

  it("returns 503 when admin backend is not configured (valid code, valid cookie)", async () => {
    const { POST } = await import("@/app/api/admin/mfa/verify/route");
    const { ADMIN_MFA_CHALLENGE_COOKIE } = await import("@/lib/admin-auth");

    const response = await POST(
      mfaRequest(
        "/api/admin/mfa/verify",
        { code: "123456" },
        { cookies: `${ADMIN_MFA_CHALLENGE_COOKIE}=fake-challenge-token` },
      ),
    );
    // Reaches the Convex check, which is unconfigured.
    expect(response.status).toBe(503);
  });

  it("never sets a session cookie on any failure path", async () => {
    const { POST } = await import("@/app/api/admin/mfa/verify/route");
    const { ADMIN_SESSION_COOKIE } = await import("@/lib/admin-auth");

    const failures = await Promise.all([
      // No challenge cookie.
      POST(mfaRequest("/api/admin/mfa/verify", { code: "123456" })),
      // Invalid code format, with challenge cookie.
      POST(
        mfaRequest(
          "/api/admin/mfa/verify",
          { code: "abc" },
          { cookies: "fc_admin_mfa_challenge=tok" },
        ),
      ),
    ]);

    for (const response of failures) {
      const setCookie = response.headers.get("set-cookie") ?? "";
      expect(setCookie).not.toContain(ADMIN_SESSION_COOKIE);
    }
  });
});
