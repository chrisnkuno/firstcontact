import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeFailures,
  runChain,
  sendEmail,
  structuredCompletion,
  webSearch,
  type ProviderResult,
} from "@/lib/providers";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("runChain", () => {
  it("reports unconfigured rather than throwing when no provider exists", async () => {
    const result = await runChain([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures[0].code).toBe("unconfigured");
  });

  it("returns the first success without calling later providers", async () => {
    const second = vi.fn();
    const result = await runChain<string>([
      { provider: "a", run: async () => ({ ok: true, provider: "a", data: "first" }) },
      { provider: "b", run: second as unknown as () => Promise<ProviderResult<string>> },
    ]);

    expect(result).toEqual({ ok: true, provider: "a", data: "first" });
    expect(second).not.toHaveBeenCalled();
  });

  it("falls through a retryable failure to the next provider", async () => {
    const result = await runChain<string>([
      {
        provider: "a",
        run: async () => ({
          ok: false,
          failures: [{ provider: "a", code: "network_error", message: "down", retryable: true }],
        }),
      },
      { provider: "b", run: async () => ({ ok: true, provider: "b", data: "second" }) },
    ]);
    expect(result).toEqual({ ok: true, provider: "b", data: "second" });
  });

  // A 4xx means the request itself was wrong. Replaying it elsewhere would fail
  // identically while exposing the same founder data to one more processor.
  it("stops at a non-retryable failure instead of trying the next provider", async () => {
    const second = vi.fn();
    const result = await runChain<string>([
      {
        provider: "a",
        run: async () => ({
          ok: false,
          failures: [{ provider: "a", code: "provider_error", message: "bad request", retryable: false }],
        }),
      },
      { provider: "b", run: second as unknown as () => Promise<ProviderResult<string>> },
    ]);

    expect(result.ok).toBe(false);
    expect(second).not.toHaveBeenCalled();
  });
});

describe("structuredCompletion", () => {
  it("parses OpenAI Responses output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ output_text: JSON.stringify({ subject: "hi" }) })),
    );
    const result = await structuredCompletion<{ subject: string }>(
      [{ kind: "openai-responses", name: "openai", apiKey: "k", model: "gpt-5.4-nano" }],
      { instructions: "i", input: {}, schemaName: "s", schema: {} },
    );
    expect(result).toMatchObject({ ok: true, provider: "openai", data: { subject: "hi" } });
  });

  // Anthropic structured output arrives as forced tool-use arguments, already
  // an object — not as JSON text needing a parse.
  it("reads Anthropic structured output from the forced tool call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ content: [{ type: "tool_use", input: { subject: "from-tool" } }] }),
      ),
    );
    const result = await structuredCompletion<{ subject: string }>(
      [{ kind: "anthropic", name: "anthropic", apiKey: "k", model: "claude-haiku-4-5-20251001" }],
      { instructions: "i", input: {}, schemaName: "s", schema: {} },
    );
    expect(result).toMatchObject({ ok: true, data: { subject: "from-tool" } });
  });

  it("fails over from a 500 to the next provider", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ type: "tool_use", input: { subject: "backup" } }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await structuredCompletion<{ subject: string }>(
      [
        { kind: "openai-responses", name: "openai", apiKey: "k", model: "m" },
        { kind: "anthropic", name: "anthropic", apiKey: "k", model: "m" },
      ],
      { instructions: "i", input: {}, schemaName: "s", schema: {} },
    );
    expect(result).toMatchObject({ ok: true, provider: "anthropic" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fail over on a 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "bad schema" }, 400));
    vi.stubGlobal("fetch", fetchMock);

    const result = await structuredCompletion(
      [
        { kind: "openai-responses", name: "openai", apiKey: "k", model: "m" },
        { kind: "anthropic", name: "anthropic", apiKey: "k", model: "m" },
      ],
      { instructions: "i", input: {}, schemaName: "s", schema: {} },
    );
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports malformed JSON rather than returning a partial object", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ output_text: "{not json" })));
    const result = await structuredCompletion(
      [{ kind: "openai-responses", name: "openai", apiKey: "k", model: "m" }],
      { instructions: "i", input: {}, schemaName: "s", schema: {} },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures[0].code).toBe("malformed_response");
  });
});

describe("webSearch", () => {
  // The whole point of normalizing: downstream evidence handling must not know
  // which vendor produced a result.
  it("normalizes Exa, Tavily and Brave to the same shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ results: [{ url: "https://a.example", title: "A", highlights: ["h"] }] })),
    );
    const exa = await webSearch([{ kind: "exa", name: "exa", apiKey: "k" }], "q");
    expect(exa).toMatchObject({ ok: true, data: { results: [{ url: "https://a.example", highlights: ["h"] }] } });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ results: [{ url: "https://a.example", title: "A", content: "body" }] })),
    );
    const tavily = await webSearch([{ kind: "tavily", name: "tavily", apiKey: "k" }], "q");
    expect(tavily).toMatchObject({ ok: true, data: { results: [{ url: "https://a.example", highlights: ["body"] }] } });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ web: { results: [{ url: "https://a.example", title: "A", description: "d" }] } }),
      ),
    );
    const brave = await webSearch([{ kind: "brave", name: "brave", apiKey: "k" }], "q");
    expect(brave).toMatchObject({ ok: true, data: { results: [{ url: "https://a.example", highlights: ["d"] }] } });
  });

  it("drops results with no URL rather than emitting unciteable evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ results: [{ title: "no url" }, { url: "https://ok.example" }] })),
    );
    const result = await webSearch([{ kind: "exa", name: "exa", apiKey: "k" }], "q");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.results).toHaveLength(1);
  });
});

describe("sendEmail", () => {
  it("sends an idempotency key and one-click unsubscribe headers via Resend", async () => {
    // Typed with the fetch signature so the recorded call can be inspected;
    // an untyped vi.fn() records calls as `[]` and tsc rejects the destructure.
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      jsonResponse({ id: "msg_1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail(
      [{ kind: "resend", name: "resend", apiKey: "k", from: "a@b.example" }],
      {
        to: "c@d.example",
        subject: "s",
        text: "t",
        unsubscribeUrl: "https://u.example",
        idempotencyKey: "key-123",
      },
    );

    expect(result).toMatchObject({ ok: true, data: { id: "msg_1" } });
    const init = fetchMock.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-123");
    const body = JSON.parse(init.body as string);
    expect(body.headers["List-Unsubscribe"]).toBe("<https://u.example>");
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("reads the SendGrid message id from its response header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 202, headers: { "x-message-id": "sg-1" } })),
    );
    const result = await sendEmail(
      [{ kind: "sendgrid", name: "sendgrid", apiKey: "k", from: "a@b.example" }],
      { to: "c@d.example", subject: "s", text: "t", unsubscribeUrl: "https://u.example", idempotencyKey: "k" },
    );
    expect(result).toMatchObject({ ok: true, data: { id: "sg-1" } });
  });

  it("fails over from Resend to Postmark on a 502", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "upstream" }, 502))
      .mockResolvedValueOnce(jsonResponse({ MessageID: "pm-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail(
      [
        { kind: "resend", name: "resend", apiKey: "k", from: "a@b.example" },
        { kind: "postmark", name: "postmark", apiKey: "k", from: "a@b.example" },
      ],
      { to: "c@d.example", subject: "s", text: "t", unsubscribeUrl: "https://u.example", idempotencyKey: "k" },
    );
    expect(result).toMatchObject({ ok: true, provider: "postmark", data: { id: "pm-1" } });
  });
});

describe("describeFailures", () => {
  it("summarises without leaking anything sensitive", () => {
    const summary = describeFailures([
      { provider: "openai", code: "provider_error", message: "openai returned 500", retryable: true },
      { provider: "anthropic", code: "network_error", message: "unreachable", retryable: true },
    ]);
    expect(summary).toBe("openai: provider_error; anthropic: network_error");
    expect(summary).not.toContain("Bearer");
  });
});

describe("OpenAI-compatible gateways without strict schema support", () => {
  // CircuitNotion, some OpenRouter routes and self-hosted gateways accept
  // chat completions but reject `response_format: json_schema`. Without the
  // retry these providers would be unusable for the only thing this codebase
  // asks a model to do.
  it("retries in plain JSON mode when the gateway rejects json_schema", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "unknown parameter response_format" }, 400))
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: '{"subject":"ok","body":"b","claimsToVerify":[]}' } }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await structuredCompletion<{ subject: string }>(
      [
        {
          kind: "openai-chat",
          name: "circuitnotion",
          apiKey: "k",
          model: "circuit-2-turbo",
          baseUrl: "https://api.circuitnotion.com/v1",
        },
      ],
      {
        instructions: "draft",
        input: {},
        schemaName: "outreach_draft",
        schema: { type: "object", required: ["subject", "body", "claimsToVerify"] },
      },
    );

    expect(result).toMatchObject({ ok: true, provider: "circuitnotion", data: { subject: "ok" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The retry must carry the schema in the prompt, since the parameter was refused.
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(retryBody.response_format).toEqual({ type: "json_object" });
    expect(retryBody.messages[0].content).toContain("JSON Schema");
  });

  it("strips a markdown code fence that plain JSON mode often adds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ choices: [{ message: { content: '```json\n{"subject":"fenced"}\n```' } }] }),
      ),
    );
    const result = await structuredCompletion<{ subject: string }>(
      [{ kind: "openai-chat", name: "gw", apiKey: "k", model: "m", baseUrl: "https://gw.example/v1" }],
      { instructions: "i", input: {}, schemaName: "s", schema: {} },
    );
    expect(result).toMatchObject({ ok: true, data: { subject: "fenced" } });
  });

  // Without strict mode the gateway guarantees nothing about shape, so a reply
  // missing a required field must be rejected rather than passed downstream.
  it("rejects a response missing required fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ choices: [{ message: { content: '{"subject":"only"}' } }] })),
    );
    const result = await structuredCompletion(
      [{ kind: "openai-chat", name: "gw", apiKey: "k", model: "m", baseUrl: "https://gw.example/v1" }],
      {
        instructions: "i",
        input: {},
        schemaName: "s",
        schema: { type: "object", required: ["subject", "body"] },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures[0].code).toBe("malformed_response");
      expect(result.failures[0].message).toContain("body");
    }
  });
});
