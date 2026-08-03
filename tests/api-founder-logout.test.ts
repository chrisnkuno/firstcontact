import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/founder/logout/route";
import { FOUNDER_SESSION_COOKIE } from "@/lib/founder-auth";

// The logout route is deliberately unconditional: it clears the session cookie
// whether or not Convex is configured, and whether or not the token is valid.
// The only job these tests verify is that the cookie is always cleared and
// the response is always a 200 {"ok":true}.

const APP_ORIGIN = "https://firstcontact.example";

function logoutRequest({ cookies = "" }: { cookies?: string } = {}) {
  return new NextRequest(`${APP_ORIGIN}/api/founder/logout`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookies ? { cookie: cookies } : {}),
    },
  });
}

beforeEach(() => {
  vi.stubEnv("CONVEX_URL", "");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  vi.stubEnv("FOUNDER_ACTION_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/founder/logout", () => {
  it("always returns ok:true and a 200", async () => {
    const response = await POST(logoutRequest());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("clears the founder session cookie when one is present", async () => {
    const response = await POST(
      logoutRequest({ cookies: `${FOUNDER_SESSION_COOKIE}=some-session-token` }),
    );
    expect(response.status).toBe(200);

    // The response must set the cookie to empty with maxAge=0 to clear it.
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(FOUNDER_SESSION_COOKIE);
    expect(setCookie).toMatch(/max-age=0/i);
  });

  it("still returns ok:true and clears the cookie even without a session cookie", async () => {
    // No cookie sent — the route must be safe and idempotent.
    const response = await POST(logoutRequest());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    // Cookie should still be cleared (or not set) — either is acceptable,
    // but there must be no unexpired session cookie remaining.
    const setCookie = response.headers.get("set-cookie") ?? "";
    if (setCookie.includes(FOUNDER_SESSION_COOKIE)) {
      expect(setCookie).toMatch(/max-age=0/i);
    }
  });

  it("returns ok:true even when Convex revocation fails (best-effort)", async () => {
    // Simulate a token present but Convex unreachable — the cookie clear must
    // not be skipped.
    vi.stubEnv("CONVEX_URL", "https://convex-down.example");
    vi.stubEnv("FOUNDER_ACTION_SECRET", "some-secret");

    // ConvexHttpClient will throw since there is no real server at that URL.
    const response = await POST(
      logoutRequest({ cookies: `${FOUNDER_SESSION_COOKIE}=real-looking-token` }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    // Cookie must still be cleared regardless of the Convex error.
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(FOUNDER_SESSION_COOKIE);
    expect(setCookie).toMatch(/max-age=0/i);
  });
});
