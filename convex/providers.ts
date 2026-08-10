/**
 * Thin REST clients for the three external providers.
 *
 * Deliberately `fetch` rather than the `openai`, `resend` and `svix` SDKs.
 * Those packages pull in Node built-ins, which would force every calling
 * action into Convex's Node runtime — slower to start, and a much larger
 * dependency surface for what are three straightforward JSON endpoints. Using
 * fetch keeps all of this in the V8 runtime and removed three direct
 * dependencies outright.
 *
 * Every function here returns a discriminated result instead of throwing on a
 * provider error, because callers need to distinguish "the provider said no"
 * (surface it, do not retry) from "the network failed" (retryable) — an
 * exception flattens that distinction.
 */

export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };

const OPENAI_URL = "https://api.openai.com/v1/responses";
const EXA_URL = "https://api.exa.ai/search";
const RESEND_URL = "https://api.resend.com/emails";

function failure(status: number, code: string, message: string): ProviderResult<never> {
  return { ok: false, status, code, message };
}

/**
 * OpenAI Responses API with a strict JSON schema.
 *
 * `strict: true` plus `additionalProperties: false` is what makes the parsed
 * output safe to trust structurally — without it the model may return extra or
 * missing keys and every caller would need its own defensive parsing.
 */
export async function openAiStructured<T>({
  apiKey,
  model,
  instructions,
  input,
  schemaName,
  schema,
}: {
  apiKey: string;
  model: string;
  instructions: string;
  input: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<ProviderResult<T>> {
  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions,
        input: JSON.stringify(input),
        text: {
          format: { type: "json_schema", name: schemaName, strict: true, schema },
        },
      }),
    });
  } catch {
    return failure(502, "network_error", "The language model provider was unreachable");
  }

  if (!response.ok) {
    return failure(502, "provider_error", `Language model provider returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: { content?: { text?: string }[] }[];
  };
  const text = payload.output_text ?? payload.output?.[0]?.content?.[0]?.text;
  if (!text) return failure(502, "empty_response", "The language model returned no output");

  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return failure(502, "malformed_response", "The language model returned unparseable output");
  }
}

export type ExaResult = { title?: string; url?: string; author?: string; highlights?: string[] };

export async function exaSearch({
  apiKey,
  query,
  numResults = 20,
}: {
  apiKey: string;
  query: string;
  numResults?: number;
}): Promise<ProviderResult<{ requestId?: string; results: ExaResult[] }>> {
  let response: Response;
  try {
    response = await fetch(EXA_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
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
    return failure(502, "network_error", "The discovery provider was unreachable");
  }

  if (!response.ok) {
    return failure(502, "provider_error", `Discovery provider returned ${response.status}`);
  }

  const payload = (await response.json()) as { requestId?: string; results?: ExaResult[] };
  return { ok: true, data: { requestId: payload.requestId, results: payload.results ?? [] } };
}

export async function resendSend({
  apiKey,
  from,
  to,
  subject,
  text,
  unsubscribeUrl,
  idempotencyKey,
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  unsubscribeUrl: string;
  idempotencyKey: string;
}): Promise<ProviderResult<{ id: string | null }>> {
  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        // Resend deduplicates on this key, which is what makes a retry after a
        // network timeout safe: the recipient cannot receive the message twice.
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [{ name: "application", value: "firstcontact" }],
      }),
    });
  } catch {
    return failure(502, "network_error", "The email provider was unreachable");
  }

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { message?: string } | null;
    return failure(502, "provider_error", detail?.message ?? `Email provider returned ${response.status}`);
  }

  const payload = (await response.json()) as { id?: string };
  return { ok: true, data: { id: payload.id ?? null } };
}
