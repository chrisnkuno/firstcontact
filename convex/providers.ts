import type {
  EmailProviderConfig,
  LlmProviderConfig,
  SearchProviderConfig,
} from "../lib/providers";

export {
  describeFailures,
  sendEmail,
  structuredCompletion,
  webSearch,
  type ProviderResult,
  type SearchResponse,
} from "../lib/providers";

/**
 * Resolves provider chains from the Convex deployment environment.
 *
 * Each capability reads an ordered, comma-separated preference list and keeps
 * only the entries whose credentials are actually present. That means a
 * half-configured deployment degrades to the providers that *can* work rather
 * than failing at call time on one that cannot — and a capability with nothing
 * configured returns an empty chain, which callers surface as "unconfigured"
 * rather than as an error.
 *
 * Defaults preserve the original single-vendor behaviour, so an existing
 * deployment that only sets `OPENAI_API_KEY`, `EXA_API_KEY` and `RESEND_API_KEY`
 * keeps working with no new configuration.
 */

function orderFrom(value: string | undefined, fallback: string[]): string[] {
  const configured = value
    ?.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return configured && configured.length > 0 ? configured : fallback;
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * The default drafting model.
 *
 * `gpt-5.4-nano` rather than the `gpt-5-nano` this project shipped with:
 * OpenAI documents it as the direct successor for exactly this class of
 * work (cheap, fast, structured extraction and short generation). Override
 * per-provider with `<PROVIDER>_MODEL` — a model id is a deployment decision
 * that changes faster than this source does.
 */
const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-5.4-nano",
  anthropic: "claude-haiku-4-5-20251001",
  openrouter: "openai/gpt-5.4-nano",
  circuitnotion: "circuit-2-turbo",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
};

const OPENAI_COMPATIBLE_BASE_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  // CircuitNotion exposes an OpenAI-compatible surface, so it needs no adapter
  // of its own. Its documentation covers chat completions and streaming but
  // does not mention strict json_schema or function calling — the openai-chat
  // adapter retries in plain JSON mode when a gateway rejects the schema, which
  // is what makes this usable for structured drafting. Worth re-checking as
  // their API matures.
  circuitnotion: "https://api.circuitnotion.com/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
  together: "https://api.together.xyz/v1",
};

export function llmProviders(): LlmProviderConfig[] {
  const order = orderFrom(env("LLM_PROVIDER_ORDER"), ["openai", "anthropic"]);
  const configs: LlmProviderConfig[] = [];

  for (const name of order) {
    if (name === "openai") {
      const apiKey = env("OPENAI_API_KEY");
      if (apiKey) {
        configs.push({
          kind: "openai-responses",
          name: "openai",
          apiKey,
          model: env("OPENAI_MODEL") ?? DEFAULT_MODELS.openai,
          baseUrl: env("OPENAI_BASE_URL"),
        });
      }
      continue;
    }

    if (name === "anthropic") {
      const apiKey = env("ANTHROPIC_API_KEY");
      if (apiKey) {
        configs.push({
          kind: "anthropic",
          name: "anthropic",
          apiKey,
          model: env("ANTHROPIC_MODEL") ?? DEFAULT_MODELS.anthropic,
          baseUrl: env("ANTHROPIC_BASE_URL"),
        });
      }
      continue;
    }

    // Everything else is treated as an OpenAI-compatible chat endpoint, which
    // covers OpenRouter, Groq, DeepSeek, Together and self-hosted gateways
    // without needing a bespoke adapter for each.
    const upper = name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const apiKey = env(`${upper}_API_KEY`);
    const baseUrl = env(`${upper}_BASE_URL`) ?? OPENAI_COMPATIBLE_BASE_URLS[name];
    const model = env(`${upper}_MODEL`) ?? DEFAULT_MODELS[name];
    if (apiKey && baseUrl && model) {
      configs.push({ kind: "openai-chat", name, apiKey, model, baseUrl });
    }
  }

  return configs;
}

export function searchProviders(): SearchProviderConfig[] {
  const order = orderFrom(env("SEARCH_PROVIDER_ORDER"), ["exa", "tavily", "brave"]);
  const keys: Record<string, string | undefined> = {
    exa: env("EXA_API_KEY"),
    tavily: env("TAVILY_API_KEY"),
    brave: env("BRAVE_API_KEY"),
  };

  return order
    .filter((name): name is "exa" | "tavily" | "brave" => name in keys && Boolean(keys[name]))
    .map((name) => ({ kind: name, name, apiKey: keys[name]! }));
}

export function emailProviders(): EmailProviderConfig[] {
  const order = orderFrom(env("EMAIL_PROVIDER_ORDER"), ["resend", "postmark", "sendgrid"]);
  const sharedFrom = env("EMAIL_FROM") ?? env("RESEND_FROM");

  const definitions: Record<string, { kind: EmailProviderConfig["kind"]; apiKey?: string; from?: string }> = {
    resend: { kind: "resend", apiKey: env("RESEND_API_KEY"), from: env("RESEND_FROM") ?? sharedFrom },
    postmark: { kind: "postmark", apiKey: env("POSTMARK_API_KEY"), from: env("POSTMARK_FROM") ?? sharedFrom },
    sendgrid: { kind: "sendgrid", apiKey: env("SENDGRID_API_KEY"), from: env("SENDGRID_FROM") ?? sharedFrom },
  };

  const configs: EmailProviderConfig[] = [];
  for (const name of order) {
    const definition = definitions[name];
    // A sending address is as load-bearing as the key: a provider configured
    // without one would fail at send time, after the policy gates have already
    // passed and the operator believes the message is going out.
    if (definition?.apiKey && definition.from) {
      configs.push({ kind: definition.kind, name, apiKey: definition.apiKey, from: definition.from });
    }
  }
  return configs;
}

/** Capability readiness, for the operator dashboard and deployment checks. */
export function providerReadiness() {
  return {
    llm: llmProviders().map((config) => ({ name: config.name, model: config.model })),
    search: searchProviders().map((config) => config.name),
    email: emailProviders().map((config) => config.name),
  };
}
