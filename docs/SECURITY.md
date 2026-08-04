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

## Response headers and Content Security Policy

`next.config.ts` sets `Content-Security-Policy`, `Strict-Transport-Security`
(production only), `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`,
`Cross-Origin-Resource-Policy`, and `X-DNS-Prefetch-Control` on every route.

The policy is `default-src 'self'` with `connect-src 'self'`, `object-src
'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, and `form-action 'self'`.
`'unsafe-eval'` is development-only, for hot reloading.

`script-src` retains `'unsafe-inline'`, and that is a measured decision rather
than an oversight. Next.js streams its React Server Component payload as
roughly nineteen inline `self.__next_f.push(...)` scripts per page. Removing
`'unsafe-inline'` requires per-request nonces, nonces must be minted in
middleware, and a statically prerendered page has no request to mint one from —
the nonce in the response header would not match the build-time HTML, so every
script on every static page would be blocked. This was measured, not assumed:
with nonce middleware in place, all thirty script tags on the prerendered
homepage carried no nonce. Buying a strict `script-src` therefore means
rendering every marketing and documentation route dynamically.

What the rest of the policy still buys with inline script allowed: an injected
`<script src="https://attacker.example">` is blocked by `script-src 'self'`, and
`connect-src 'self'` blocks exfiltration to an attacker-controlled host, which
is what most payloads need in order to be useful.

The residual risk is HTML injection, and the codebase currently offers no
vector for it: no `dangerouslySetInnerHTML`, no `eval`, no `new Function`, no
third-party script origins, self-hosted fonts, and every browser fetch is
same-origin. **Introducing any of those means revisiting this decision** and
accepting dynamic rendering in exchange for a nonce.

## Supply chain

Dependencies are pinned to exact versions so an install without the lockfile
cannot resolve to something CI never verified, and a CI job fails the build if
`package.json` and `bun.lock` disagree. `bun audit` runs in CI at
`--audit-level=high`. Transitive advisories are resolved through `overrides` in
`package.json` where a compatible fixed release exists. CodeQL runs on every
change to `main` and weekly, so a newly published rule is applied to existing
code.

## Secret management

Never commit `.env*` files. Use separate provider projects and keys per environment. Rotate keys after suspected exposure and at a documented interval. Exa, OpenAI, and Resend keys belong only in a server or Convex environment. `NEXT_PUBLIC_*` variables are public by definition.

## Launch security gate

- Wire authentication and remove browser-supplied actor IDs.
- Keep the durable signup intake limiter deployed; add shared rate limiting to catalogue interest, discovery, drafting, and send routes.
- Add CSRF/origin protection to authenticated mutations.
- ~~Add security headers and a Content Security Policy.~~ Done — see above. Still
  outstanding: a nonce-based `script-src`, which requires dynamic rendering.
- Encrypt especially sensitive fields where deployment risk calls for it.
- ~~Add dependency and static-analysis CI scans.~~ Done — `bun audit` and CodeQL.
  Still outstanding: enable GitHub secret scanning and push protection in the
  repository settings, which cannot be configured from a workflow file.
- Exercise backup restore and tenant deletion.
- Complete an external review before handling real contact or founder data at scale.
