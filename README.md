# FirstContact

**An open-source, human-controlled fundraising discovery and outreach platform for overlooked founders and thoughtful investors.**

[![CI](https://github.com/chrisnkuno/firstcontact/actions/workflows/ci.yml/badge.svg)](https://github.com/chrisnkuno/firstcontact/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-173d2d.svg)](LICENSE)
[![Responsible outreach](https://img.shields.io/badge/outreach-human--approved-c8fa52.svg)](docs/COMPLIANCE.md)

[Public deployment](https://firstcontact-tau.vercel.app) · [Join FirstContact](https://firstcontact-tau.vercel.app/signup) · [Architecture](docs/ARCHITECTURE.md) · [Deployment guide](docs/DEPLOYMENT.md)

FirstContact is a reference application for building a more transparent fundraising pipeline. It combines:

- private interest onboarding for startups, institutions, investors, founders, operators, advisors, and researchers;
- source-backed investor discovery;
- explainable matching;
- evidence-constrained introduction drafting;
- founder and operator approval controls;
- policy-gated email delivery; and
- a consent-based catalogue where investors can express interest without receiving private founder data.

It is deliberately **not an autonomous cold-email bot**. Automation may research, normalize, rank, or draft. It may not invent facts, approve a message, ignore a suppression, or bypass source, jurisdiction, consent, rate-limit, and operator gates.

## Start here

Choose the path that matches what you want to do:

| Goal | Where to start |
|---|---|
| Explore the product | Run the app with no provider keys and use its labeled preview data |
| Collect real signup interest | Configure Convex and the shared signup ingestion secret |
| Add real investor research | Configure Exa, then add durable normalization and review |
| Generate factual drafts | Configure OpenAI and keep human review mandatory |
| Send real email | Complete authentication, authorization, compliance, suppression, webhook, and deliverability work first |
| Adapt the project for your community | Fork it, replace the branding and policies, and review the MIT license |

## What works today

### Persisted

- The three-step `/signup` questionnaire validates input through the shared contract in `lib/domain.ts`.
- `POST /api/signups` applies payload limits, a honeypot, validation, and an in-memory per-instance rate limit.
- Convex stores private interest records and deduplicates them by normalized email.
- Repeat submissions update the existing record, retain its review status, and increment a submission counter.
- Consent time, participation goals, referral source, product-update preference, and a private reference are recorded.
- The homepage's "Real interest, counted honestly" section reads live, non-PII aggregate signup counts straight from Convex (`convex/signups.ts#publicStats`, `GET /api/stats`). With no Convex configured it shows an explicit empty state instead of any number — it never fabricates activity.
- `POST /api/catalogue-interest` persists a real, timestamped, deduplicated interest signal (email + optional note, keyed to a catalogue profile id) to the `catalogueInterestSignals` Convex table when an investor clicks "Express interest" on `/catalogue`. This is genuine write, not local-only preview state.

A signup creates an `interestSignups` record only. It does **not** automatically create an account, organization, catalogue listing, campaign, investor match, or outbound message.

### Preview and reference implementation

- The public site, founder workspace, and VC catalogue are responsive product demonstrations.
- Catalogue organizations, matches, drafts, metrics, and pipeline events are fictional and labeled preview data — only the interest signal an investor submits against a profile is real and persisted (see above).
- Without an Exa key, discovery returns labeled sample matches.
- Without an OpenAI key, drafting returns a non-fabricated placeholder.
- The Convex schema models the intended multi-tenant product, but most workspace workflows are not yet wired to it.

### Automated UI translation

- A site-wide language switcher (`components/language-switcher.tsx`) and `<T>`/`useTranslation()` (`components/translation-provider.tsx`) wrap the homepage, catalogue, and signup copy so founders and investors who don't read English can use the product.
- `POST /api/translate` batches strings and, with `OPENAI_API_KEY` configured, asks the model to translate them; without a key it echoes the original text back rather than fabricating a translation, matching this project's other provider adapters.
- Translations are cached client-side per language for the session. This is a best-effort UI layer, not a substitute for professionally reviewed content in the languages an operator formally supports.

### Available but not production-complete

- Exa discovery can return live search results, but those results are not yet normalized or persisted as reviewed investor records.
- OpenAI can produce structured drafts from supplied facts, but the route needs deployment-specific authentication, usage limits, and audit persistence.
- Resend delivery is fail-closed behind an operator token, an explicit outbound flag, approval, source, jurisdiction, suppression, postal-identity, and unsubscribe checks.
- Resend webhook signatures are verified, but verified events are not yet persisted to Convex.
- Account authentication and identity-derived tenant authorization still need to be configured before private workspaces can serve real users.

See [Launch readiness](docs/LAUNCH_READINESS.md) before treating any part of the preview as production-ready.

## Product tour

| Route | Purpose | Data behavior |
|---|---|---|
| `/` | Explains the operating model and principles; shows a live, honest signup-count section | Public content + real Convex aggregate stats |
| `/signup` | Collects participation interest | Persists only when Convex signup ingestion is configured |
| `/workspace` | Demonstrates the founder/operator control center | Fictional preview state |
| `/catalogue` | Demonstrates consent-based company discovery | Fictional profiles; "Express interest" persists a real signal to Convex |
| `/responsible-outreach` | Explains the outreach safety model | Public content |
| `/privacy`, `/terms`, `/security` | Baseline policy and security information | Templates that operators must adapt |
| `/api/health` | Reports configured provider capabilities | Never returns secret values |
| `/api/stats` | Reports real, non-PII signup aggregates | `{ configured: false }` rather than fabricated zeros when Convex isn't set up |
| `/api/translate` | Translates UI copy for the language switcher | Echoes input back unchanged without `OPENAI_API_KEY` |

Every page also offers a language switcher (English, French, Spanish, Portuguese, Swahili, Arabic, Bengali) that machine-translates on-screen copy through `/api/translate`, aimed at widening who can realistically use the catalogue and signup flow beyond English speakers.

## Local development

### Requirements

- [Node.js 22](https://nodejs.org/)
- [Bun 1.3.14 or newer](https://bun.sh/)

### Install and run

```bash
git clone https://github.com/chrisnkuno/firstcontact.git
cd firstcontact
bun install
cp .env.example .env.local
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

No provider credentials are required to explore the public pages, workspace, catalogue, sample discovery, or placeholder drafting. Signup submissions intentionally fail with a clear message until Convex is configured; the app does not pretend to save them locally.

### Verify a change

```bash
bun run typecheck
bun run test
bun run lint
bun run build
git diff --check
```

Or run the combined application checks:

```bash
bun run check
```

`bun run check` runs typechecking, tests, lint, and a production build. `git diff --check` remains a separate Git check.

Other useful commands:

| Command | Purpose |
|---|---|
| `bun run dev` | Start the Next.js development server |
| `bun run test:watch` | Run Vitest in watch mode |
| `bun run convex:dev` | Start or configure a Convex development deployment |
| `bun run convex:deploy` | Deploy Convex functions |
| `bun run map:build` | Rebuild the optimized world map asset |
| `bun run start` | Serve an already-built production bundle |

## Enable persisted signup

Convex is the production source of truth. The browser does not write signup records directly; the Next.js route validates the form and calls a secret-protected Convex mutation.

1. Create or connect a Convex development deployment:

   ```bash
   bun run convex:dev
   ```

2. Generate a high-entropy ingestion secret. For example:

   ```bash
   openssl rand -hex 32
   ```

3. Set that exact secret in the Convex environment:

   ```bash
   bunx convex env set SIGNUP_INGEST_SECRET
   ```

4. Put the Convex URL and the same secret in `.env.local`:

   ```dotenv
   CONVEX_URL=https://your-deployment.convex.cloud
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   SIGNUP_INGEST_SECRET=replace-with-the-generated-secret
   ```

5. Restart `bun run dev`, submit `/signup`, and inspect the `interestSignups` table in the Convex dashboard.

Never prefix `SIGNUP_INGEST_SECRET` or a provider API key with `NEXT_PUBLIC_`. Variables with that prefix are included in browser-accessible code.

The current rate limiter is held in the memory of one Next.js process. A multi-instance production deployment should replace it with a shared durable limiter or edge/WAF control.

## Environment variables

Copy `.env.example` to `.env.local` for local work. Use separate credentials and Convex deployments for development, staging, and production.

| Variable | Visibility | Required for | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public | Correct canonical URLs and metadata | Use the deployed HTTPS origin in production |
| `CONVEX_DEPLOYMENT` | Tooling | Convex CLI project selection | Normally written by Convex tooling |
| `CONVEX_URL` | Server only | Signup persistence | Preferred server-side Convex URL |
| `NEXT_PUBLIC_CONVEX_URL` | Public | Convex client configuration and health reporting | A deployment URL, not a secret |
| `SIGNUP_INGEST_SECRET` | Server only | Authorized signup and catalogue-interest ingestion | Must match the Convex environment value; also gates `POST /api/catalogue-interest` |
| `EXA_API_KEY` | Server only | Live investor discovery | Do not expose the discovery route publicly without auth and budgets |
| `OPENAI_API_KEY` | Server only | Structured draft generation and `/api/translate` | Without it, translation echoes the original text instead of fabricating a translation |
| `OPENAI_MODEL` | Server only | Draft model selection | Defaults to `gpt-5-nano` |
| `RESEND_API_KEY` | Server only | Email transport | Requires a verified sending domain |
| `RESEND_FROM` | Server only | Email sender identity | Use a monitored, reply-capable address |
| `RESEND_WEBHOOK_SECRET` | Server only | Resend webhook verification | Supplied by the webhook configuration |
| `OUTBOUND_EMAIL_ENABLED` | Server only | Global outbound gate | Keep `false` until activation checks pass |
| `OUTBOUND_API_TOKEN` | Server only | Temporary send-route authorization | Replace with identity-derived authorization |
| `OUTBOUND_DAILY_LIMIT` | Server only | Intended operator limit | Documented configuration; not yet enforced by the current send route |
| `DATA_RETENTION_DAYS` | Server only | Intended retention policy | Documented configuration; deletion scheduling is not yet wired |

Check the effective capability state without revealing credentials:

```bash
curl http://localhost:3000/api/health
```

The overall `mode` is `configured` only when the main provider variables are present. That status means “credentials appear configured,” not “the deployment has passed production readiness.”

## Provider adapters

### Exa discovery

`POST /api/discover` accepts a validated founder profile. Without `EXA_API_KEY`, it returns labeled sample matches. With a key, it returns live Exa source results and the provider request ID.

Live search results are evidence candidates, not verified contacts. Before using them, normalize domains, deduplicate firms, classify contact types, preserve source URLs, verify claims, apply budgets, and write the reviewed result to Convex.

### OpenAI drafting

`POST /api/draft` accepts founder facts and investor evidence. With `OPENAI_API_KEY`, it requests strict structured output containing:

- `subject`
- `body`
- `claimsToVerify`

The prompt prohibits invented metrics, relationships, portfolio claims, and contact details. A generated draft still requires human review and approval. The current route is a narrow adapter, not a complete authenticated drafting workflow.

### Resend delivery

`POST /api/send` requires:

- `Authorization: Bearer <OUTBOUND_API_TOKEN>`;
- `OUTBOUND_EMAIL_ENABLED=true`;
- an explicitly approved message;
- a public source URL;
- a reviewed jurisdiction;
- a supported business-contact classification;
- no active suppression;
- a sender postal identity;
- an unsubscribe URL; and
- a stable idempotency key.

Do not enable it merely because Resend credentials are available. First add identity-derived organization authorization, durable daily limits, campaign state, audit events, suppression checks backed by Convex, and end-to-end bounce, complaint, and unsubscribe handling.

`POST /api/webhooks/resend` verifies Svix signatures over the raw request body. Connecting verified events to `webhookEvents`, message state, and suppressions remains an explicit implementation step.

## Architecture

```text
Public signup
  → Next.js validation and abuse controls
  → secret-protected Convex mutation
  → private, deduplicated interest record

Authenticated organization (target architecture)
  → approved profile and visibility fields
  → Exa discovery
  → source capture, normalization, and deduplication
  → transparent matching and evidence-constrained draft
  → human review
  → policy and suppression gate
  → Resend
  → signed delivery events
  → Convex audit history
```

The intended responsibility boundaries are:

- **Convex:** durable product state, tenancy, workflow intent, scheduling, suppressions, and audit history.
- **Exa:** replaceable discovery adapter.
- **OpenAI:** replaceable extraction and drafting adapter.
- **Resend:** replaceable email transport adapter.
- **Next.js:** public experience, authenticated application surfaces, server boundaries, and webhooks.

Shared input and policy contracts belong in `lib/domain.ts`. Policy changes should include tests. External providers must never become the source of truth for consent, approval, suppression, or campaign state.

For the table model and workflow invariants, read [Architecture](docs/ARCHITECTURE.md).

## Repository map

```text
app/                    Next.js pages, metadata, and API routes
components/             Public, signup, catalogue, workspace, and translation UI
convex/                 Schema, signup persistence, catalogue interest, campaigns, webhooks, and jobs
lib/domain.ts           Shared Zod validation and TypeScript contracts
lib/compliance.ts       Deterministic outbound policy gate
lib/matching.ts         Explainable deterministic matching
lib/network-stats.ts    Real, non-PII Convex signup aggregates for the homepage
lib/languages.ts        Supported UI translation languages
lib/demo-data.ts        Clearly labeled fictional preview data
tests/                  Signup, compliance, and matching tests
docs/                   Architecture, operations, compliance, and roadmap
scripts/                Repository maintenance and asset scripts
```

## Adapting and self-hosting

The project is licensed under the [MIT License](LICENSE), so you may use, copy, modify, and distribute it under the license terms.

Before operating your own instance:

1. Replace FirstContact branding, contact details, canonical URLs, and deployment links.
2. Adapt the privacy notice, terms, retention periods, controller identity, and responsible-outreach policy to your organization and jurisdictions.
3. Configure authentication and prove that users cannot cross organization boundaries.
4. Keep provider credentials server-side and use separate projects for each environment.
5. Replace all preview records with consented, source-backed data; never present fictional records as live.
6. Add shared rate limits, per-tenant budgets, monitoring, deletion workflows, backups, and incident ownership.
7. Verify domain authentication, unsubscribe, complaint, bounce, suppression, and emergency-pause behavior before enabling email.
8. Run the full verification gate and a staging pilot with synthetic or explicitly authorized recipients.

This repository provides technical controls and operational starting points, not legal advice or a turnkey authorization to contact people. The operator of each deployment is responsible for its data sources, notices, lawful basis, consent model, deliverability, and local regulations.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change.

Core project rules:

- preserve the distinction between preview and persisted/provider data;
- never add auto-send behavior that bypasses approval or policy gates;
- keep all secrets server-side;
- use `lib/domain.ts` for shared validation;
- add tests when changing policy behavior; and
- do not invent contacts, investment mandates, traction, or production verification.

Security issues should follow [SECURITY.md](SECURITY.md), not a public issue.

## Documentation

- [Architecture and data flow](docs/ARCHITECTURE.md)
- [Responsible outreach and privacy](docs/COMPLIANCE.md)
- [Security model](docs/SECURITY.md)
- [Deployment and provider setup](docs/DEPLOYMENT.md)
- [Launch-readiness status](docs/LAUNCH_READINESS.md)
- [Product roadmap](docs/ROADMAP.md)
- [World map data and attribution](docs/MAP_DATA.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE). You may adapt and redistribute FirstContact under the license terms. Attribution notices in third-party data and dependencies remain subject to their own licenses.
