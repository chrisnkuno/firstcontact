import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/translate/route";

// The OpenAI SDK builds `responses` lazily on instances and cannot be spied on
// via the prototype. We replace the whole module with a proper class mock so
// `new OpenAI()` inside the route returns an object whose `responses.create`
// we can control per test.
const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      responses = { create: mockCreate };
    },
  };
});

// Helper — builds a plain Request (the route doesn't use NextRequest-specific
// features such as cookies or nextUrl, so a bare Request is fine here).
function translateRequest(body: unknown) {
  return new Request("http://localhost/api/translate", {
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

describe("POST /api/translate input validation", () => {
  it("rejects a missing or non-JSON body", async () => {
    const response = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "not json",
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("rejects an empty texts array", async () => {
    const response = await POST(translateRequest({ texts: [], target: "fr" }));
    expect(response.status).toBe(400);
  });

  it("rejects an unsupported target language code", async () => {
    const response = await POST(translateRequest({ texts: ["Hello"], target: "zz" }));
    expect(response.status).toBe(400);
  });

  it("rejects a texts array that exceeds the 80-item limit", async () => {
    const texts = Array.from({ length: 81 }, (_, index) => `String ${index}`);
    const response = await POST(translateRequest({ texts, target: "fr" }));
    expect(response.status).toBe(400);
  });

  it("rejects a text entry that exceeds 600 characters", async () => {
    const response = await POST(
      translateRequest({ texts: ["x".repeat(601)], target: "fr" }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/translate identity mode (target=en)", () => {
  it("returns the texts unchanged with mode=identity when target is English", async () => {
    const texts = ["Hello", "Welcome to FirstContact"];
    const response = await POST(translateRequest({ texts, target: "en" }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      mode: string;
      translated: boolean;
      translations: string[];
    };
    expect(body.mode).toBe("identity");
    expect(body.translated).toBe(false);
    expect(body.translations).toEqual(texts);
  });
});

describe("POST /api/translate preview mode (no OPENAI_API_KEY)", () => {
  it("echoes the original strings back with mode=preview when no API key is set", async () => {
    const texts = ["Sign up", "Explore the catalogue"];
    const response = await POST(translateRequest({ texts, target: "fr" }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      mode: string;
      translated: boolean;
      translations: string[];
    };
    expect(body.mode).toBe("preview");
    expect(body.translated).toBe(false);
    // The strings must be returned as-is, never fabricated.
    expect(body.translations).toEqual(texts);
  });

  it("echoes correctly for every supported non-English language code", async () => {
    const texts = ["Join FirstContact"];
    for (const target of ["fr", "es", "pt", "sw", "ar", "bn"]) {
      const response = await POST(translateRequest({ texts, target }));
      expect(response.status).toBe(200);
      const body = (await response.json()) as { mode: string; translations: string[] };
      expect(body.mode).toBe("preview");
      expect(body.translations).toEqual(texts);
    }
  });
});

describe("POST /api/translate live mode (OPENAI_API_KEY configured)", () => {
  it("returns mode=live with translated=true when OpenAI returns a matching array", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-fake-key");

    const texts = ["Sign up", "Explore"];
    const translated = ["S'inscrire", "Explorer"];

    mockCreate.mockResolvedValue({
      output_text: JSON.stringify({ translations: translated }),
    });

    const response = await POST(translateRequest({ texts, target: "fr" }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      mode: string;
      translated: boolean;
      translations: string[];
    };
    expect(body.mode).toBe("live");
    expect(body.translated).toBe(true);
    expect(body.translations).toEqual(translated);
  });

  it("falls back to preview mode when OpenAI returns a mismatched array length", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-fake-key");

    mockCreate.mockResolvedValue({
      // Returns only one translation for two inputs — mismatch.
      output_text: JSON.stringify({ translations: ["S'inscrire"] }),
    });

    const texts = ["Sign up", "Explore"];
    const response = await POST(translateRequest({ texts, target: "fr" }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { mode: string; translations: string[] };
    expect(body.mode).toBe("preview");
    expect(body.translations).toEqual(texts);
  });

  it("falls back to preview mode when OpenAI throws", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-fake-key");

    mockCreate.mockRejectedValue(new Error("provider error"));

    const texts = ["Hello"];
    const response = await POST(translateRequest({ texts, target: "es" }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { mode: string; translations: string[] };
    expect(body.mode).toBe("preview");
    expect(body.translations).toEqual(texts);
  });
});
