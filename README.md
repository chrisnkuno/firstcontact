# FirstContact

**An open-source, human-controlled fundraising discovery and outreach platform for overlooked founders and thoughtful investors.**

[![CI](https://github.com/chrisnkuno/firstcontact/actions/workflows/ci.yml/badge.svg)](https://github.com/chrisnkuno/firstcontact/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-173d2d.svg)](LICENSE)
[![Responsible outreach](https://img.shields.io/badge/outreach-human--approved-c8fa52.svg)](docs/COMPLIANCE.md)

[Public deployment](https://firstcontact-tau.vercel.app) · [Join FirstContact](https://firstcontact-tau.vercel.app/signup) · [Architecture](docs/ARCHITECTURE.md) · [Deployment guide](docs/DEPLOYMENT.md)

FirstContact is an open-source product and backend foundation for building a more transparent fundraising pipeline. It combines:

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
| Develop the workflow backend | Configure Convex, start FastAPI, and use the service-token-protected workflow API |
| Execute isolated research jobs | Configure E2B and run the FastAPI dispatcher; the implemented worker currently produces a research plan, not investor records |
| Add real investor discovery | Build the scoped FastAPI provider gateway, then connect Exa normalization and review |
| Generate factual drafts | Configure OpenAI and keep human review mandatory |
| Send real email | Complete authentication, authorization, compliance, suppression, webhook, and deliverability work first |
| Adapt the project for your community | Fork it, replace the branding and policies, and review the MIT license |

## What works today

### Persisted

- The three-step `/signup` questionnaire validates input through the shared contract in `lib/domain.ts`.
- `POST /api/signups` applies actual-byte payload limits, same-origin browser checks, a honeypot, shared validation, and durable Convex-backed rate limits.
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

- The FastAPI backend in `services/api` implements OIDC-forwarded, membership-checked workflow creation; durable Convex leasing and budgets; a separate dispatcher; scoped E2B execution; and an Exa gateway that persists source evidence as unreviewed candidates. Browser OIDC, reviewed normalization, drafting, workspace wiring, deployment, and delivery are not yet active.
- Exa discovery can return live search results, but those results are not yet normalized or persisted as reviewed investor records.
- OpenAI can produce structured drafts from supplied facts, but the route needs deployment-specific authentication, usage limits, and audit persistence.
- Resend delivery is fail-closed behind an operator token, an explicit outbound flag, approval, source, jurisdiction, suppression, postal-identity, and unsubscribe checks.
- Resend webhook signatures are verified, but verified events are not yet persisted to Convex.
- Account authentication and identity-derived tenant authorization still need to be configured before private workspaces can serve real users.

See [Launch readiness](docs/LAUNCH_READINESS.md) before treating any part of the preview as production-ready.

## Product tour

| Route | Purpose | Data behavior |
|---|---|---|
| `/` | Explains the operating model and principles; shows a live, honest signup-count section and an economics diagram | Public content + real Convex aggregate stats |
| `/signup` | Collects participation interest | Persists only when Convex signup ingestion is configured |
| `/workspace` | Demonstrates the founder/operator control center | Fictional preview state |
| `/catalogue` | Demonstrates consent-based company discovery | Fictional profiles; "Express interest" persists a real signal to Convex |
| `/plan` | Founder outreach funnel planner: how many investor contacts a raise requires, run backward from the goal | Real math over user-editable assumptions, plus a live Convex network scorecard |
| `/pacing` | Investor portfolio pacing planner: how many companies to review/meet to hit a portfolio target | Real math over user-editable assumptions, plus a live Convex catalogue-interest scorecard |
| `/research/private-equity` | Comprehensive global capital-lifecycle brief spanning angels through recycled liquidity | Public research; proposed direction, not a live matching capability |
| `/how-it-works` | Expands the four-step model, with real-vs-preview status per step | Public content |
| `/system` | Expands the four accountable system layers (discover/interpret/control/learn) | Public content |
| `/principles` | Expands the four founding principles | Public content |
| `/for-founders`, `/for-investors` | Audience-specific overviews linking to the relevant tools | Public content |
| `/responsible-outreach` | Explains the outreach safety model | Public content |
| `/privacy`, `/terms`, `/security` | Baseline policy and security information | Templates that operators must adapt |
| `/admin` | Techadmin dashboard: platform metrics and signup pipeline management | Requires a techadmin session; see [Techadmin access](#techadmin-access) |
| `/api/health` | Reports configured provider capabilities | Never returns secret values |
| `/api/stats` | Reports real, non-PII signup aggregates | `{ configured: false }` rather than fabricated zeros when Convex isn't set up |
| `/api/catalogue-stats` | Reports real, non-PII catalogue-interest aggregates | `{ configured: false }` rather than fabricated zeros when Convex isn't set up |
| `/api/translate` | Translates UI copy for the language switcher | Echoes input back unchanged without `OPENAI_API_KEY` |

Every page also offers a language switcher (English, French, Spanish, Portuguese, Swahili, Arabic, Bengali) that machine-translates on-screen copy through `/api/translate`, aimed at widening who can realistically use the catalogue and signup flow beyond English speakers.

## Research direction: the global capital lifecycle

The complete, source-linked analysis is available as:

- the [`/research/private-equity`](https://firstcontact-tau.vercel.app/research/private-equity) project page;
- [the repository research brief](docs/PRIVATE_EQUITY_RESEARCH.md); and
- [the downloadable PDF](public/firstcontact-private-equity-research.pdf).

The research finds that private equity is a valid and potentially important extension to FirstContact alongside angels, venture capital, philanthropy, development finance, credit, search funds, and strategic buyers—but not as another entry in one undifferentiated investor list. Each form of capital solves a different company state.

### What the model adds

- **Growth equity** can finance established companies seeking expansion, operational improvement, or new markets.
- **Buyout and turnaround capital** can acquire controlling stakes or entire recoverable businesses.
- **Replacement capital and secondaries** can give founders, angels, and VCs liquidity that can be recycled into new companies.
- **Search funds, independent sponsors, and micro-PE** can bring operator-led acquisition to smaller profitable businesses.
- **Strategic corporate buyers** are essential exit participants and should be modeled alongside PE firms.
- **Catalytic philanthropy and DFIs** can fund justified readiness, technical-assistance, first-loss, guarantee, or market-building gaps without subsidising commercial acquisitions that would happen anyway.

| Capital type | Best fit | Primary ecosystem role |
|---|---|---|
| Philanthropy and grants | Public goods, research, ecosystem infrastructure, excluded or pre-commercial innovators | Preparation, inclusion, shared infrastructure, and justified catalytic risk |
| Angels and syndicates | Formation, pre-seed, first product, first customers | First conviction, local knowledge, mentoring, and early credibility |
| Venture capital | Innovative young companies capable of rapid, outsized growth | Long-term risk equity, governance, hiring, networks, and follow-on capital |
| Growth equity | Proven revenue and a repeatable model ready to scale | Go-to-market expansion, systems, market entry, and selective early-holder liquidity |
| Private credit | Predictable cash flow or assets capable of repayment | Growth, working capital, or acquisition finance without mandatory dilution |
| SME and impact PE | Established businesses needing scale, succession, governance, or transformation | Operating improvement, recapitalisation, ownership transition, and exit readiness |
| Search funds and independent sponsors | One durable, usually profitable succession-stage business | Owner liquidity plus a dedicated new operator |
| Strategic buyers | Companies with product, customer, talent, supply-chain, or geographic synergy | Distribution, integration, and direct partial or full exits |
| Secondaries and continuation capital | Existing holders needing liquidity before a company sale | Shareholder and fund liquidity without forcing an operating-company exit |
| DFIs and public finance | Risk, tenor, currency, or pioneering gaps blocking private investment | Guarantees, standards, technical assistance, and market creation |

The lifecycle is:

```text
Angels
  → VC
  → growth equity
  → PE / search funds
  → strategic buyers / secondaries
  → recycled capital
```

This can increase ecosystem liquidity through partial founder sales, full acquisitions, early-investor secondaries, recapitalisations that mix secondary and primary capital, operational value creation, and stronger exit readiness. It cannot guarantee liquidity or returns. “10× the value” is an ambition—not a platform promise, matching assumption, or verified outcome.

### Responsible product boundary

The research page and PDF are public documentation. They do **not** mean that FirstContact currently provides PE matching, acquisition execution, due diligence, investment advice, or verified buyer mandates.

A future implementation should use distinct opportunity paths:

| Path | Appropriate capital |
|---|---|
| Build | Angels, pre-seed and seed VC, grants |
| Scale | VC, growth equity, private credit |
| Transform | SME PE, impact PE, search funds, independent sponsors |
| Exit or succeed | Strategic buyers, PE buyers, management buyouts, secondaries |

PE and acquisition matching would require hard, source-backed fields beyond the current stage/sector/geography score:

- primary capital, partial secondary, recapitalisation, majority sale, or full acquisition;
- acceptable ownership percentage and control rights;
- revenue, EBITDA, profitability, enterprise-value, and equity-check ranges;
- leverage policy and operating history;
- founder willingness to remain, transition, or exit;
- succession, governance, reporting, and data-room readiness;
- specific value-creation capabilities;
- target holding period and credible exit routes;
- country, currency, regulatory, and jurisdiction restrictions;
- employment, impact, and responsible-ownership commitments; and
- evidence for each fund or investment vehicle’s mandate.

Matching must operate at the **fund or investment-vehicle level**, not only at the firm level. One global PE firm can manage vehicles with materially different geographies, deal sizes, sectors, control requirements, and holding periods.

The global system must also represent country eligibility, fund domicile, sanctions and foreign-ownership restrictions, transaction currency and FX risk, local presence, responsible deal team, fund vintage and active period, language, decision location, verified source date, and whether a provider makes direct investments, fund commitments, co-investments, grants, guarantees, credit, or advisory support.

The responsible sequence is: classify the actual need; apply hard eligibility gates; assess company and ownership readiness; rank value-add fit; review leverage, control, employment, mission, community, sanctions, corruption, and privacy risks; require human approval; and preserve every source, review, approval, suppression, and outcome in Convex.

Success is measured by verified mandates, qualified matches accepted by both sides, appropriate time-to-capital, primary capital mobilised, secondary liquidity created, responsible dilution and control outcomes, operating and governance improvement, responsible exits, recycled capital, philanthropic additionality, and harms—not by investor counts or messages sent.

The complete brief documents the supporting evidence from Invest Europe, IFC, AVCA, IESE, and OECD; the role and limits of philanthropy; search-fund relevance; value-creation mechanisms; platform changes; and risks such as excessive leverage, destructive cost cutting, founder loss of control, mission drift, forced exits, currency exposure, and unverified operating claims.

## Local development

### Requirements

- [Node.js 22](https://nodejs.org/)
- [Bun 1.3.14 or newer](https://bun.sh/)
- [Python 3.12 or 3.13](https://www.python.org/)
- [uv 0.10.12 or newer](https://docs.astral.sh/uv/)

### Install and run

```bash
git clone https://github.com/chrisnkuno/firstcontact.git
cd firstcontact
bun install
uv sync --project services/api
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
bun run api:check
```

`bun run check` runs the Next.js/TypeScript typecheck, tests, lint, and production build. `bun run api:check` runs Ruff, strict mypy, and FastAPI tests. `git diff --check` remains a separate Git check.

### What the tests cover

CI splits these into separate jobs so a failure names the stage that broke.

| Suite | What it protects |
|---|---|
| `api-send`, `api-signups`, `api-admin-login` | That the HTTP routes enforce the policy, not just that the policy functions are correct in isolation — including that a fully valid, human-approved message is still refused while the operator flag is off, and that no failure path ever hands out a session cookie |
| `compliance`, `signup`, `signup-security`, `matching` | The pure policy, validation, origin-trust, and ranking contracts |
| `outreach-math`, `portfolio-math`, `network-stats` | The arithmetic behind `/plan`, `/pacing`, and the homepage signal bars |
| `totp` | RFC 6238 vectors for the hand-rolled MFA implementation |
| `economics-flywheel`, `world-signal` | The homepage diagrams, including geometry invariants and that every map marker matches its city's true Mercator projection |
| `contrast` | That every small-text colour in `globals.css` still clears WCAG AA, measured from the stylesheet itself |
| FastAPI `test_api`, `test_worker` | Service-token enforcement, truthful health state, actor derivation, leases, minimal sandbox input, safe blockers, retries, digest verification, and non-invented research-plan output |

Other useful commands:

| Command | Purpose |
|---|---|
| `bun run dev` | Start the Next.js development server |
| `bun run test:watch` | Run Vitest in watch mode |
| `bun run test:coverage` | Run the suite with a V8 coverage report |
| `bun audit` | Check installed dependencies against known advisories |
| `bun run convex:dev` | Start or configure a Convex development deployment |
| `bun run convex:deploy` | Deploy Convex functions |
| `bun run api:dev` | Start the FastAPI backend on port 8000 |
| `bun run api:worker` | Run the continuous Convex-backed dispatcher |
| `bun run api:dispatch` | Claim and execute at most one workflow step, then exit |
| `bun run api:test` | Run only the FastAPI pytest suite, without Ruff or mypy |
| `bun run api:check` | Run Ruff, strict mypy, and FastAPI tests |
| `bun run map:build` | Rebuild the optimized world map asset |
| `bun run research:pdf` | Rebuild `public/firstcontact-private-equity-research.pdf` from `docs/PRIVATE_EQUITY_RESEARCH.md` |
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

Signup limits are enforced atomically in Convex with keyed HMAC digests: a broad address limit protects the service without penalizing a shared office or mobile network after only a few signups, while a tighter address-and-email limit catches repeated submissions. Expired limiter records are deleted by the daily maintenance job. An edge/WAF layer is still recommended at larger scale.

## FastAPI + E2B workflow backend

`services/api` is the implemented Python backend foundation. It is separate from the Next.js process and uses Convex as the durable source of truth.

```text
service-authenticated FastAPI request
  → Convex creates an idempotent workflow run and pending step
  → FastAPI dispatcher reclaims expired leases and atomically claims work
  → E2B starts a secure sandbox with outbound internet disabled
  → fixed Python worker receives only the minimum profile fields it needs
  → FastAPI validates run, step, attempt, schema, size, and artifact SHA-256
  → Convex stores the terminal artifact and audit event
```

The dispatcher handles bounded retry scheduling for transient failures. Missing E2B configuration becomes an explicit `blocked` workflow result; it never substitutes preview contacts or synthetic success. Late results cannot advance an expired lease, and the sandbox is killed in `finally` after every completed execution attempt.

The first installed add-on is `investor_research_plan`. It produces bounded search queries, preferred source categories, and hard review gates from stage, sector, geography, and target capital regions. It does **not** call Exa, invent contacts, persist investor matches, draft email, or authorize delivery.

### Start the backend

Configure persistence first:

```bash
openssl rand -hex 32 # generate WORKFLOW_ACTION_SECRET
openssl rand -hex 32 # generate a distinct FASTAPI_SERVICE_TOKEN
bunx convex env set WORKFLOW_ACTION_SECRET
```

Put the values in `.env.local`, deploy the updated Convex functions, and start the API:

```bash
bun run convex:deploy
bun run api:dev
```

For E2B execution, set `EXECUTION_MODE=e2b`, a server-only `E2B_API_KEY`, and a reviewed `E2B_TEMPLATE` ID. Then run the continuous dispatcher separately:

```bash
bun run api:worker
```

The current workflow-create endpoint requires an existing approved/running Convex campaign. The public workspace does not create that campaign yet, and `FASTAPI_SERVICE_TOKEN` must never be sent to browser code. Organization OIDC and identity-derived membership are required before wiring these endpoints to `/workspace`.

Useful backend endpoints:

| Endpoint | Behavior |
|---|---|
| `GET /healthz` | Liveness and truthful Convex/E2B capability flags; never returns secrets |
| `GET /readyz` | Returns 503 when selected persistence/execution dependencies are missing |
| `GET /v1/addons` | Lists bounded, versioned capabilities; service-token protected |
| `POST /v1/workflows/runs` | Creates an idempotent Convex workflow for an approved campaign |
| `GET /v1/workflows/runs/{id}` | Reads durable run, step, blocker, and artifact state |
| `POST /v1/workflows/runs/{id}/cancel` | Cancels outstanding work and revokes its lease |
| `POST /internal/v1/dispatcher/once` | Performs one dispatch iteration; service-token protected |
| `POST /internal/v1/worker/result` | Accepts only a lease-bound, digest-verified worker result |

See [the backend README](services/api/README.md) for container deployment and [the E2B pipeline architecture](docs/E2B_OUTREACH_PIPELINE.md) for the remaining production phases.

## Environment variables

Copy `.env.example` to `.env.local` for local work. Use separate credentials and Convex deployments for development, staging, and production.

| Variable | Visibility | Required for | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public | Correct canonical URLs and metadata | Use the deployed HTTPS origin in production |
| `CONVEX_DEPLOYMENT` | Tooling | Convex CLI project selection | Normally written by Convex tooling |
| `CONVEX_URL` | Server only | Signup persistence | Preferred server-side Convex URL |
| `NEXT_PUBLIC_CONVEX_URL` | Public | Convex client configuration and health reporting | A deployment URL, not a secret |
| `SIGNUP_INGEST_SECRET` | Server only | Authorized signup and catalogue-interest ingestion | Must match the Convex environment value; also gates `POST /api/catalogue-interest` |
| `WORKFLOW_ACTION_SECRET` | Server only | FastAPI-to-Convex workflow mutations | Set the same high-entropy value in FastAPI and Convex; keep distinct from every other secret |
| `FASTAPI_SERVICE_TOKEN` | Server only | Dispatcher and service-only FastAPI endpoints | Never expose it to a browser; user workflow routes reject this token |
| `OIDC_ISSUER_URL` | Server only | Organization authentication | Must identify the same OIDC issuer in FastAPI and Convex |
| `OIDC_AUDIENCE` | Server only | Organization authentication | API audience/application ID expected by Convex |
| `EXECUTION_MODE` | Server only | Workflow executor selection | `disabled` by default; set `e2b` only after E2B review and configuration |
| `E2B_API_KEY` | Server only | Creating isolated workflow sandboxes | Used by FastAPI only and never passed into the sandbox |
| `E2B_TEMPLATE` | Server only | Sandbox base image/template | Use a reviewed template ID in staging/production |
| `E2B_TEMPLATE_VERSION` | Server only | Artifact provenance | Recorded in every result envelope |
| `E2B_WORKER_VERSION` | Server only | Worker provenance | Recorded in every result envelope |
| `E2B_TIMEOUT_SECONDS` | Server only | Sandbox runtime ceiling | Bounded to 30–900 seconds by FastAPI settings |
| `WORKFLOW_LEASE_SECONDS` | Server only | Durable step lease | Bounded to 30–900 seconds; expired leases are recovered before dispatch |
| `DISPATCHER_POLL_SECONDS` | Server only | Continuous dispatcher cadence | Bounded to 0.25–60 seconds |
| `DISPATCHER_ID` | Server only | Lease ownership and diagnostics | Use a stable, non-secret deployment identifier |
| `WORKER_GATEWAY_URL` | Server only | Scoped E2B-to-FastAPI research calls | HTTPS FastAPI origin; E2B network access is restricted to this host |
| `EXA_TIMEOUT_SECONDS` | Server only | Provider request ceiling | Bounded to 5–120 seconds |
| `ADMIN_BOOTSTRAP_SECRET` | Server only | Creating/resetting techadmin accounts | Only used by `scripts/create-admin.mjs`; safe to rotate/remove after the accounts you need exist |
| `ADMIN_ACTION_SECRET` | Server only | All authenticated `/admin` reads and writes | Must match the Convex environment value; distinct from `SIGNUP_INGEST_SECRET` so its blast radius stays contained |
| `FOUNDER_ACTION_SECRET` | Server only | Creating/resetting participant `/status` accounts and all authenticated `/status` reads | Must match the Convex environment value; only used by `scripts/create-founder-account.mjs` and the founder-auth session path; distinct from every other secret |
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
curl http://localhost:8000/healthz
curl -i http://localhost:8000/readyz
```

The overall `mode` is `configured` only when the main provider variables are present. That status means “credentials appear configured,” not “the deployment has passed production readiness.”

## Techadmin access

`/admin` is a separate, operator-only surface for platform metrics and moving `interestSignups` records through the pipeline (`new → reviewing → invited → active/declined`). It is not part of the founder/investor product surface, is excluded from the sitemap, and is disallowed in `robots.ts`.

1. Set `ADMIN_BOOTSTRAP_SECRET` and `ADMIN_ACTION_SECRET` on the Convex deployment (`bunx convex env set ADMIN_BOOTSTRAP_SECRET` / `... ADMIN_ACTION_SECRET`), then put the same values in `.env.local` (never commit them).
2. Create an account: `node --env-file=.env.local scripts/create-admin.mjs you@example.com`. This prints a one-time password — store it in a password manager; it is never shown again and never written to disk.
3. Sign in at `/admin/login`. Multi-factor sign-in is mandatory: the first sign-in redirects to `/admin/mfa/setup`, which shows a QR code for any TOTP authenticator app (Google Authenticator, 1Password, Authy). Every sign-in after that requires both the password and a current 6-digit code.
4. Sessions are Convex-backed, revocable, HttpOnly/Secure/SameSite=Strict cookies (12-hour TTL). Password hashing uses scrypt; login and MFA verification are rate-limited per address and per address+email.

There is no password-reset flow yet — re-run the bootstrap script with the same email to reset a forgotten password, and no MFA-recovery/backup-codes flow — losing the authenticator device currently requires an operator to reset the account by hand in the Convex dashboard. This is a deliberately narrow, single-role (`techadmin`) auth system, not the full multi-tenant `@convex-dev/auth` integration referenced in [Launch readiness](docs/LAUNCH_READINESS.md) for founder/investor accounts — that remains a separate, unbuilt piece of work.

## Participant status access

`/status` is a separate, low-privilege sign-in for an existing `interestSignups` record. It shows only that record’s real pipeline status and submitted context; it does not activate investor discovery, outreach, catalogue publication, admin access, or the intended full multi-tenant workspace.

Create or reset the primary signup holder:

```bash
node --env-file=.env.local scripts/create-founder-account.mjs founder@example.com
```

An operator may provision another verified organization member against the same existing signup without fabricating a second signup or consent record:

```bash
node --env-file=.env.local scripts/create-founder-account.mjs member@example.com --signup-email=founder@example.com
```

Both operations require the server-only `FOUNDER_ACTION_SECRET`. Passwords are salted-scrypt hashes at rest and generated passwords are printed once. A linked member can read only the explicitly linked signup record; the browser cannot create or change membership links.

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

Implemented workflow foundation
  → approved profile and visibility fields
  → FastAPI validates the request; Convex records workflow intent
  → FastAPI dispatcher leases work and controls E2B
  → E2B isolated execution produces a bounded research-plan artifact
  → validated artifact and audit history return to Convex

Planned production extension
  → scoped Exa discovery and source normalization
  → transparent matching and evidence-constrained drafting
  → human review
  → Convex policy, budget, rate, and suppression gate
  → FastAPI Resend adapter
  → signed delivery events
  → Convex audit history
```

The intended responsibility boundaries are:

- **Convex:** durable product state, tenancy, workflow intent, leases, suppressions, budgets, and audit history.
- **FastAPI:** main application backend and orchestrator for authenticated APIs, E2B dispatch, provider gateways, webhooks, streaming progress, retries, and add-ons.
- **E2B:** elastic isolated execution fabric for research, normalization, evaluation, drafting, and generated artifacts; never approval or delivery authority.
- **Exa:** replaceable discovery adapter.
- **OpenAI:** replaceable extraction and drafting adapter.
- **Resend:** replaceable email transport adapter.
- **Next.js:** public experience and authenticated application surfaces; production workflow calls move behind FastAPI.

Shared input and policy contracts belong in `lib/domain.ts`. Policy changes should include tests. External providers must never become the source of truth for consent, approval, suppression, or campaign state.

For the table model and workflow invariants, read [Architecture](docs/ARCHITECTURE.md). For implemented status, E2B execution topology, add-on model, optimization strategy, and remaining phases, read [FastAPI + E2B outreach pipeline architecture](docs/E2B_OUTREACH_PIPELINE.md).

## Repository map

```text
app/                    Next.js pages, metadata, and API routes
services/api/           FastAPI application backend, dispatcher, E2B adapter, contracts, and tests
components/             Public, signup, catalogue, workspace, and translation UI
convex/                 Schema, signup persistence, catalogue interest, campaigns, webhooks, and jobs
lib/domain.ts           Shared Zod validation and TypeScript contracts
lib/compliance.ts       Deterministic outbound policy gate
lib/matching.ts         Explainable deterministic matching
lib/network-stats.ts    Real, non-PII Convex signup aggregates for the homepage
lib/catalogue-stats.ts  Real, non-PII Convex catalogue-interest aggregates
lib/outreach-math.ts    Founder outreach funnel formulas (/plan)
lib/portfolio-math.ts   Investor pacing formulas (/pacing)
lib/languages.ts        Supported UI translation languages
lib/demo-data.ts        Clearly labeled fictional preview data
lib/password.ts         scrypt password hashing for techadmin accounts
lib/totp.ts             Self-contained RFC 6238 TOTP for techadmin MFA
lib/admin-auth.ts       Techadmin session issuance/verification
lib/admin-data.ts       Server-side reads for the techadmin dashboard
tests/                  Route, component, policy, math, crypto, and contrast tests
docs/                   Architecture, operations, compliance, and roadmap
scripts/                Repository maintenance, asset, and admin-bootstrap scripts
```

## Adapting and self-hosting

The project is licensed under the [MIT License](LICENSE), so you may use, copy, modify, and distribute it under the license terms.

Before operating your own instance:

1. Replace FirstContact branding, contact details, canonical URLs, and deployment links.
2. Adapt the privacy notice, terms, retention periods, controller identity, and responsible-outreach policy to your organization and jurisdictions.
3. Configure authentication and prove that users cannot cross organization boundaries.
4. Keep provider credentials server-side and use separate projects for each environment.
5. Replace all preview records with consented, source-backed data; never present fictional records as live.
6. Deploy FastAPI API and dispatcher processes separately, keep internal routes edge-restricted, and configure Convex/E2B without exposing service credentials to Next.js.
7. Add shared rate limits, per-tenant budgets, monitoring, deletion workflows, backups, and incident ownership.
8. Verify domain authentication, unsubscribe, complaint, bounce, suppression, and emergency-pause behavior before enabling email.
9. Run both verification gates and a staging pilot with synthetic or explicitly authorized recipients.

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
- [FastAPI + E2B production outreach pipeline](docs/E2B_OUTREACH_PIPELINE.md)
- [Responsible outreach and privacy](docs/COMPLIANCE.md)
- [Security model](docs/SECURITY.md)
- [Deployment and provider setup](docs/DEPLOYMENT.md)
- [Launch-readiness status](docs/LAUNCH_READINESS.md)
- [Product roadmap](docs/ROADMAP.md)
- [Global capital lifecycle research](docs/PRIVATE_EQUITY_RESEARCH.md)
- [Private equity research PDF](public/firstcontact-private-equity-research.pdf)
- [World map data and attribution](docs/MAP_DATA.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE). You may adapt and redistribute FirstContact under the license terms. Attribution notices in third-party data and dependencies remain subject to their own licenses.
