# Security and threat model

## Reporting a vulnerability

Do not open a public issue containing exploit details or personal data. Use this repository’s enabled GitHub private vulnerability-reporting channel. Include impact, reproduction steps, and a minimal proof of concept. Independent operators must configure their own monitored reporting channel.

## Trust boundaries

- Browser input is untrusted, including URLs and founder narrative.
- Search content is untrusted and may contain prompt injection.
- Model output is untrusted, even when schema-valid.
- Webhook payloads are untrusted until signature verification succeeds.
- Provider success does not prove the intended side effect occurred exactly once.

## Primary threats and controls

| Threat | Required control |
|---|---|
| Cross-tenant data access | Identity-derived organization membership on every server function |
| Prompt injection in a source page | Delimit source text, prohibit tool authority, structured outputs, no secrets in context |
| Fabricated investor claim | Source-linked evidence and human review |
| Duplicate sends | Stable idempotency key plus persisted pre-send state |
| Forged webhook | Svix verification over raw body and event-ID deduplication |
| Suppression race | Check after approval and atomically again before queueing |
| API-key disclosure | Server-only environment variables, log redaction, least-scope keys |
| SSRF through submitted URLs | URL parsing, public-host allow policy, no unrestricted server fetch |
| Spreadsheet/formula injection in exports | Escape `=`, `+`, `-`, `@` prefixes in CSV cells |
| Resource/cost exhaustion | Per-tenant quotas, bounded results, daily send caps, workflow concurrency limits |

## Secret management

Never commit `.env*` files. Use separate provider projects and keys per environment. Rotate keys after suspected exposure and at a documented interval. Exa, OpenAI, and Resend keys belong only in a server or Convex environment. `NEXT_PUBLIC_*` variables are public by definition.

## Launch security gate

- Wire authentication and remove browser-supplied actor IDs.
- Add rate limiting to intake, discovery, drafting, and send routes.
- Add CSRF/origin protection to authenticated mutations.
- Add security headers and a strict Content Security Policy.
- Encrypt especially sensitive fields where deployment risk calls for it.
- Add dependency, secret, and static-analysis CI scans.
- Exercise backup restore and tenant deletion.
- Complete an external review before handling real contact or founder data at scale.
