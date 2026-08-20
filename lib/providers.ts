/**
 * Multi-provider adapters for the three external capabilities this product
 * needs: structured language-model output, web search, and email delivery.
 *
 * Why an abstraction rather than one vendor each:
 *
 *  - **Availability.** A cold-outreach pipeline that stops because one vendor
 *    is having an incident is a pipeline the operator cannot rely on. Each
 *    capability takes an ordered chain and falls through on transport or 5xx
 *    failures.
 *  - **Jurisdiction and cost.** Operators in different regions have different
 *    constraints on which processors they may send founder data to. That is a
 *    deployment decision, so it belongs in configuration, not in the source.
 *
 * Every adapter is plain `fetch`, so all of this runs in Convex's V8 runtime
 * rather than forcing the Node runtime for an SDK.
 *
 * Two rules hold across every adapter:
 *
 *  1. **Never fabricate.** An unconfigured capability reports itself as
 *     unconfigured; it never returns plausible-looking output.
 *  2. **Never leak the key.** Failures carry a provider name and a safe code,
 *     never the request headers, and never the key itself.
 */

export type ProviderFailure = {
  provider: string;
  /** Stable, loggable classification. */
  code: "unconfigured" | "network_error" | "provider_error" | "malformed_response" | "empty_response";
  message: string;
  /** Whether trying the next provider in the chain could plausibly succeed. */
  retryable: boolean;
};

export type ProviderResult<T> =
  | { ok: true; provider: string; data: T }
  | { ok: false; failures: ProviderFailure[] };

function failure(
  provider: string,
  code: ProviderFailure["code"],
  message: string,
  retryable = true,
): ProviderFailure {
  return { provider, code, message, retryable };
}

/**
 * Runs an ordered chain, returning the first success.
 *
 * Falls through only on *retryable* failures. A 4xx means the request itself
 * was wrong — malformed input, a rejected schema, a bad key — and replaying it
 * against another vendor would fail identically while costing another call and
 * exposing the same data to one more processor.
 */
export async function runChain<T>(
  attempts: readonly { provider: string; run: () => Promise<ProviderResult<T>> }[],
): Promise<ProviderResult<T>> {
  const failures: ProviderFailure[] = [];
  if (attempts.length === 0) {
    return {
      ok: false,
      failures: [failure("none", "unconfigured", "No provider is configured for this capability", false)],
    };
  }

  for (const attempt of attempts) {
    const result = await attempt.run();
    if (result.ok) return result;
    failures.push(...result.failures);
    if (result.failures.some((entry) => !entry.retryable)) break;
  }
  return { ok: false, failures };
}

/** Classifies an HTTP status for chain purposes. */
function statusFailure(provider: string, status: number, detail?: string): ProviderFailure {
  const retryable = status >= 500 || status === 408 || status === 429;
  return failure(
    provider,
    "provider_error",
    detail ? `${provider} returned ${status}: ${detail}` : `${provider} returned ${status}`,
    retryable,
  );
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Language models — structured output
 * ------------------------------------------------------------------ */

export type LlmProviderKind = "openai-responses" | "openai-chat" | "anthropic";

export type LlmProviderConfig = {
  kind: LlmProviderKind;
  name: string;
  apiKey: string;
  model: string;
  /** For OpenAI-compatible gateways (OpenRouter, Groq, Together, local). */
  baseUrl?: string;
};

export type StructuredRequest = {
  instructions: string;
  input: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
};

/**
 * OpenAI Responses API.
 *
 * `strict: true` with `additionalProperties: false` is what makes the parsed
 * output structurally trustworthy; without it, callers would each need their
 * own defensive parsing of a shape the model was free to vary.
 */
async function openAiResponses<T>(
  config: LlmProviderConfig,
  request: StructuredRequest,
): Promise<ProviderResult<T>> {
  const url = `${config.baseUrl ?? "https://api.openai.com/v1"}/responses`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        instructions: request.instructions,
        input: JSON.stringify(request.input),
        text: {
          format: {
            type: "json_schema",
            name: request.schemaName,
            strict: true,
            schema: request.schema,
          },
        },
      }),
    });
  } catch {
    return { ok: false, failures: [failure(config.name, "network_error", `${config.name} was unreachable`)] };
  }

  if (!response.ok) return { ok: false, failures: [statusFailure(config.name, response.status)] };

  const payload = (await safeJson(response)) as {
    output_text?: string;
    output?: { content?: { text?: string }[] }[];
  } | null;
  const text = payload?.output_text ?? payload?.output?.[0]?.content?.[0]?.text;
  if (!text) {
    return { ok: false, failures: [failure(config.name, "empty_response", `${config.name} returned no output`)] };
  }
  return parseJson<T>(config.name, text);
}

/**
 * Any OpenAI-compatible `/chat/completions` endpoint.
 *
 * Strict `json_schema` output is requested first, then retried once in plain
 * JSON mode if the gateway rejects it. That second attempt is not paranoia:
 * "OpenAI-compatible" in practice means chat completions and streaming, and
 * many gateways (CircuitNotion, some OpenRouter routes, self-hosted vLLM)
 * implement neither strict schemas nor function calling. Without the fallback,
 * every such provider would be unusable for the only thing this codebase asks a
 * model to do.
 *
 * Retrying the *same* provider with a simpler request shape is deliberately
 * different from failing over to the next one: the request was rejected for its
 * form, not its content, so reshaping it is the correct response where
 * replaying it elsewhere would not be.
 */
async function openAiChat<T>(
  config: LlmProviderConfig,
  request: StructuredRequest,
): Promise<ProviderResult<T>> {
  const url = `${config.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`;

  const post = async (body: unknown): Promise<Response | null> => {
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(body),
      });
    } catch {
      return null;
    }
  };

  const baseMessages = [
    { role: "system", content: request.instructions },
    { role: "user", content: JSON.stringify(request.input) },
  ];

  let response = await post({
    model: config.model,
    messages: baseMessages,
    response_format: {
      type: "json_schema",
      json_schema: { name: request.schemaName, strict: true, schema: request.schema },
    },
  });
  if (response === null) {
    return { ok: false, failures: [failure(config.name, "network_error", `${config.name} was unreachable`)] };
  }

  // 400/404/422 here means "I do not understand response_format", not "your
  // content was bad" — so describe the shape in the prompt instead and ask for
  // plain JSON.
  if (response.status === 400 || response.status === 404 || response.status === 422) {
    response = await post({
      model: config.model,
      messages: [
        {
          role: "system",
          content: `${request.instructions}\n\nRespond with a single JSON object and nothing else. It must match this JSON Schema exactly:\n${JSON.stringify(request.schema)}`,
        },
        baseMessages[1],
      ],
      response_format: { type: "json_object" },
    });
    if (response === null) {
      return { ok: false, failures: [failure(config.name, "network_error", `${config.name} was unreachable`)] };
    }
  }

  if (!response.ok) return { ok: false, failures: [statusFailure(config.name, response.status)] };

  const payload = (await safeJson(response)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const text = payload?.choices?.[0]?.message?.content;
  if (!text) {
    return { ok: false, failures: [failure(config.name, "empty_response", `${config.name} returned no output`)] };
  }

  const parsed = parseJson<T>(config.name, stripCodeFence(text));
  if (!parsed.ok) return parsed;
  // Without strict mode the gateway guarantees nothing about shape, so the
  // schema's own required list is checked before the value is handed onward.
  return enforceRequiredKeys<T>(config.name, parsed.data, request.schema);
}

/**
 * Removes a ```json fence, which models in plain-JSON mode frequently add
 * despite being told not to.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

function enforceRequiredKeys<T>(
  provider: string,
  data: T,
  schema: Record<string, unknown>,
): ProviderResult<T> {
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  if (required.length === 0) return { ok: true, provider, data };
  if (typeof data !== "object" || data === null) {
    return {
      ok: false,
      failures: [failure(provider, "malformed_response", `${provider} did not return an object`)],
    };
  }
  const missing = required.filter((key) => !(key in (data as Record<string, unknown>)));
  if (missing.length > 0) {
    return {
      ok: false,
      failures: [
        failure(provider, "malformed_response", `${provider} omitted required fields: ${missing.join(", ")}`),
      ],
    };
  }
  return { ok: true, provider, data };
}

/**
 * Anthropic Messages API.
 *
 * Structured output goes through a single forced tool rather than through
 * prompt instructions: `tool_choice` pins the model to emitting arguments that
 * match `input_schema`, which is the reliable equivalent of OpenAI's strict
 * JSON schema. Asking for JSON in prose and parsing the reply is not.
 */
async function anthropicStructured<T>(
  config: LlmProviderConfig,
  request: StructuredRequest,
): Promise<ProviderResult<T>> {
  const url = `${config.baseUrl ?? "https://api.anthropic.com/v1"}/messages`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: request.instructions,
        messages: [{ role: "user", content: JSON.stringify(request.input) }],
        tools: [
          {
            name: request.schemaName,
            description: "Return the result in this exact structure.",
            input_schema: request.schema,
          },
        ],
        tool_choice: { type: "tool", name: request.schemaName },
      }),
    });
  } catch {
    return { ok: false, failures: [failure(config.name, "network_error", `${config.name} was unreachable`)] };
  }

  if (!response.ok) return { ok: false, failures: [statusFailure(config.name, response.status)] };

  const payload = (await safeJson(response)) as {
    content?: { type?: string; input?: unknown }[];
  } | null;
  const toolUse = payload?.content?.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.input === undefined) {
    return { ok: false, failures: [failure(config.name, "empty_response", `${config.name} returned no structured output`)] };
  }
  return { ok: true, provider: config.name, data: toolUse.input as T };
}

function parseJson<T>(provider: string, text: string): ProviderResult<T> {
  try {
    return { ok: true, provider, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      failures: [failure(provider, "malformed_response", `${provider} returned unparseable output`)],
    };
  }
}

export function structuredCompletion<T>(
  providers: readonly LlmProviderConfig[],
  request: StructuredRequest,
): Promise<ProviderResult<T>> {
  return runChain<T>(
    providers.map((config) => ({
      provider: config.name,
      run: () => {
        if (config.kind === "anthropic") return anthropicStructured<T>(config, request);
        if (config.kind === "openai-chat") return openAiChat<T>(config, request);
        return openAiResponses<T>(config, request);
      },
    })),
  );
}

/* ------------------------------------------------------------------ *
 * Web search
 * ------------------------------------------------------------------ */

export type SearchProviderKind = "exa" | "tavily" | "brave";

export type SearchProviderConfig = { kind: SearchProviderKind; name: string; apiKey: string };

/** Normalized across vendors so downstream code never branches on provider. */
export type SearchResult = { url: string; title?: string; highlights: string[] };
export type SearchResponse = { requestId?: string; results: SearchResult[] };

async function exaSearch(
  config: SearchProviderConfig,
  query: string,
  numResults: number,
): Promise<ProviderResult<SearchResponse>> {
  let response: Response;
  try {
    response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": config.apiKey },
      body: JSON.stringify({
        query,
        type: "deep-lite",
        category: "company",
        numResults,
        contents: { highlights: { maxCharacters: 1600 } },
        moderation: true,
      }),
    });
  } catch {
    return { ok: false, failures: [failure(config.name, "network_error", "Exa was unreachable")] };
  }
  if (!response.ok) return { ok: false, failures: [statusFailure(config.name, response.status)] };

  const payload = (await safeJson(response)) as {
    requestId?: string;
    results?: { url?: string; title?: string; highlights?: string[] }[];
  } | null;

  return {
    ok: true,
    provider: config.name,
    data: {
      requestId: payload?.requestId,
      results: (payload?.results ?? [])
        .filter((entry): entry is { url: string; title?: string; highlights?: string[] } =>
          typeof entry.url === "string",
        )
        .map((entry) => ({
          url: entry.url,
          title: entry.title,
          highlights: entry.highlights ?? [],
        })),
    },
  };
}

async function tavilySearch(
  config: SearchProviderConfig,
  query: string,
  numResults: number,
): Promise<ProviderResult<SearchResponse>> {
  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        query,
        max_results: numResults,
        search_depth: "advanced",
        include_answer: false,
      }),
    });
  } catch {
    return { ok: false, failures: [failure(config.name, "network_error", "Tavily was unreachable")] };
  }
  if (!response.ok) return { ok: false, failures: [statusFailure(config.name, response.status)] };

  const payload = (await safeJson(response)) as {
    results?: { url?: string; title?: string; content?: string }[];
  } | null;

  return {
    ok: true,
    provider: config.name,
    data: {
      results: (payload?.results ?? [])
        .filter((entry): entry is { url: string; title?: string; content?: string } =>
          typeof entry.url === "string",
        )
        .map((entry) => ({
          url: entry.url,
          title: entry.title,
          // Tavily returns one content blob where Exa returns highlights; it is
          // wrapped in an array so the evidence shape stays identical.
          highlights: entry.content ? [entry.content.slice(0, 1600)] : [],
        })),
    },
  };
}

async function braveSearch(
  config: SearchProviderConfig,
  query: string,
  numResults: number,
): Promise<ProviderResult<SearchResponse>> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(numResults, 20)));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json", "x-subscription-token": config.apiKey },
    });
  } catch {
    return { ok: false, failures: [failure(config.name, "network_error", "Brave was unreachable")] };
  }
  if (!response.ok) return { ok: false, failures: [statusFailure(config.name, response.status)] };

  const payload = (await safeJson(response)) as {
    web?: { results?: { url?: string; title?: string; description?: string }[] };
  } | null;

  return {
    ok: true,
    provider: config.name,
    data: {
      results: (payload?.web?.results ?? [])
        .filter((entry): entry is { url: string; title?: string; description?: string } =>
          typeof entry.url === "string",
        )
        .map((entry) => ({
          url: entry.url,
          title: entry.title,
          highlights: entry.description ? [entry.description] : [],
        })),
    },
  };
}

export function webSearch(
  providers: readonly SearchProviderConfig[],
  query: string,
  numResults = 20,
): Promise<ProviderResult<SearchResponse>> {
  return runChain<SearchResponse>(
    providers.map((config) => ({
      provider: config.name,
      run: () => {
        if (config.kind === "tavily") return tavilySearch(config, query, numResults);
        if (config.kind === "brave") return braveSearch(config, query, numResults);
        return exaSearch(config, query, numResults);
      },
    })),
  );
}

/* ------------------------------------------------------------------ *
 * Email delivery
 * ------------------------------------------------------------------ */

export type EmailProviderKind = "resend" | "postmark" | "sendgrid";

export type EmailProviderConfig = {
  kind: EmailProviderKind;
  name: string;
  apiKey: string;
  from: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  /**
   * Only set for bulk/outreach mail. Transactional authentication mail (a
   * password reset, an address-verification code) deliberately omits it:
   * `List-Unsubscribe` on a message the recipient *asked for seconds ago* is
   * both semantically wrong — there is nothing to unsubscribe from — and a
   * deliverability anti-pattern, because providers read the header as a signal
   * that the mail is bulk.
   */
  unsubscribeUrl?: string;
  /**
   * Passed to the provider's own deduplication where one exists, which is what
   * makes a retry after a network timeout safe: the recipient cannot receive
   * the same message twice.
   */
  idempotencyKey: string;
};

const unsubscribeHeaders = (unsubscribeUrl: string | undefined) =>
  unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : {};

async function resendSend(
  config: EmailProviderConfig,
  message: EmailMessage,
): Promise<ProviderResult<{ id: string | null }>> {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        headers: unsubscribeHeaders(message.unsubscribeUrl),
        tags: [{ name: "application", value: "firstcontact" }],
      }),
    });
  } catch {
    return { ok: false, failures: [failure(config.name, "network_error", "Resend was unreachable")] };
  }
  if (!response.ok) {
    const detail = (await safeJson(response)) as { message?: string } | null;
    return { ok: false, failures: [statusFailure(config.name, response.status, detail?.message)] };
  }
  const payload = (await safeJson(response)) as { id?: string } | null;
  return { ok: true, provider: config.name, data: { id: payload?.id ?? null } };
}

async function postmarkSend(
  config: EmailProviderConfig,
  message: EmailMessage,
): Promise<ProviderResult<{ id: string | null }>> {
  let response: Response;
  try {
    response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "X-Postmark-Server-Token": config.apiKey,
      },
      body: JSON.stringify({
        From: config.from,
        To: message.to,
        Subject: message.subject,
        TextBody: message.text,
        MessageStream: "outbound",
        Headers: Object.entries(unsubscribeHeaders(message.unsubscribeUrl)).map(([Name, Value]) => ({
          Name,
          Value,
        })),
      }),
    });
  } catch {
    return { ok: false, failures: [failure(config.name, "network_error", "Postmark was unreachable")] };
  }
  if (!response.ok) {
    const detail = (await safeJson(response)) as { Message?: string } | null;
    return { ok: false, failures: [statusFailure(config.name, response.status, detail?.Message)] };
  }
  const payload = (await safeJson(response)) as { MessageID?: string } | null;
  return { ok: true, provider: config.name, data: { id: payload?.MessageID ?? null } };
}

async function sendgridSend(
  config: EmailProviderConfig,
  message: EmailMessage,
): Promise<ProviderResult<{ id: string | null }>> {
  let response: Response;
  try {
    response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: config.from },
        subject: message.subject,
        content: [{ type: "text/plain", value: message.text }],
        headers: unsubscribeHeaders(message.unsubscribeUrl),
      }),
    });
  } catch {
    return { ok: false, failures: [failure(config.name, "network_error", "SendGrid was unreachable")] };
  }
  if (!response.ok) {
    return { ok: false, failures: [statusFailure(config.name, response.status)] };
  }
  // SendGrid returns 202 with an empty body and the id in a header.
  return {
    ok: true,
    provider: config.name,
    data: { id: response.headers.get("x-message-id") },
  };
}

export function sendEmail(
  providers: readonly EmailProviderConfig[],
  message: EmailMessage,
): Promise<ProviderResult<{ id: string | null }>> {
  return runChain<{ id: string | null }>(
    providers.map((config) => ({
      provider: config.name,
      run: () => {
        if (config.kind === "postmark") return postmarkSend(config, message);
        if (config.kind === "sendgrid") return sendgridSend(config, message);
        return resendSend(config, message);
      },
    })),
  );
}

/** Flattens a failed chain into one safe, loggable sentence. */
export function describeFailures(failures: readonly ProviderFailure[]): string {
  if (failures.length === 0) return "No provider is configured";
  return failures.map((entry) => `${entry.provider}: ${entry.code}`).join("; ");
}
