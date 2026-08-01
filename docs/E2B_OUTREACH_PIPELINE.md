# FastAPI + E2B outreach pipeline architecture

> Proposed production architecture, researched 2026-08-01. This document does not claim that the E2B pipeline is implemented or live.

## Decision

Use FastAPI as FirstContact's primary application backend and workflow orchestrator. Use E2B as the elastic **execution fabric** controlled by FastAPI, not as the database, policy authority, authentication system, durable queue, or email transport.

The production responsibility split should be:

| Layer | Authority |
|---|---|
| Product state, tenant authorization, workflow intent, approvals, suppressions, budgets, audit history | Convex |
| Authenticated API, orchestration, job leasing, provider gateway, result ingestion, webhooks, streaming progress, add-on registry | FastAPI |
| Isolated research, source parsing, normalization, deduplication, evidence extraction, evaluation, and draft generation | E2B |
| Public and authenticated UI | Next.js |
| Web discovery | Exa, behind a replaceable server-side adapter |
| Model inference | OpenAI, behind a replaceable server-side adapter |
| Email delivery | Resend, called only after a fresh Convex policy check |

This three-layer design preserves the repository's existing invariant that Convex is the production source of truth, makes FastAPI the main backend developers extend, and makes E2B the place where nearly all non-trivial outreach computation runs.

E2B sandboxes are isolated Linux VMs intended for agent tool execution. The Python SDK supports versioned templates, commands, files, metadata, secure access, network policy, lifecycle controls, and pause/resume. Those are strong worker-runtime primitives; they are not a substitute for durable application state or a transactional queue. Convex mutations remain the right place to record intent and enforce atomic transitions. FastAPI owns orchestration around those transitions and uses the official Convex Python client or authenticated Convex HTTP API to query and mutate state.

Do not use FastAPI `BackgroundTasks` or process memory as the queue. Run the same Python codebase as two deployable processes: an API service and a worker/dispatcher service. Both coordinate through leased Convex records, so an API restart cannot lose a campaign.

## Current repository assessment

### Implemented foundation (2026-08-01)

- `services/api` contains the FastAPI API and continuous dispatcher entrypoints, Pydantic contracts, a Convex HTTP gateway, a pinned E2B Python SDK adapter, and tests.
- `convex/workflows.ts` and the workflow tables in `convex/schema.ts` implement durable run creation, idempotency, atomic leases, expired-lease recovery, bounded retry scheduling, cancellation, validated artifact persistence, and audit events.
- The E2B adapter creates a secure sandbox, uploads a fixed worker and immutable job, validates the result envelope and SHA-256 artifact digest, and kills the sandbox in `finally`. When research is configured, outbound access is allowlisted to the FastAPI gateway host only.
- The first `investor_research_plan` add-on produces bounded search queries and hard gates. It intentionally does not return contacts, claim live discovery, or authorize delivery.
- The scoped Exa gateway now reserves budget atomically in Convex, keeps the Exa key outside E2B, records provider operations, and persists sanitized source evidence as explicitly unreviewed candidates.
- When Convex or E2B is unconfigured, readiness and workflow state expose that condition; the backend does not substitute preview records.

Still pending are selecting/configuring the browser OIDC client, browser/workspace integration, reviewed investor normalization, model drafting, E2B lifecycle webhooks, generated cross-language schemas, continuous production deployment, and all delivery activation gates. The OIDC-aware Convex control plane and scoped Exa research code are implemented but have not been live-tested because this checkout has no OIDC, E2B, or Exa credentials.

The pre-existing application already had the right safety posture but not a durable execution workflow. The sections below distinguish that baseline from the newly implemented foundation; neither should be read as production outreach activation.

### Real today

- `lib/domain.ts` validates founder profiles and defines investor, match, campaign, and pipeline types.
- `lib/matching.ts` provides a deterministic, explainable baseline score.
- `lib/compliance.ts` fails closed on operator enablement, approval, sourcing, suppression, contact type, jurisdiction review, sender identity, and unsubscribe.
- `convex/schema.ts` models organizations, memberships, profiles, sources, investors, campaigns, matches, messages, suppressions, webhook events, and audit events.
- `convex/campaigns.ts` enforces two narrow state transitions: campaign review and message approval.
- `/api/discover`, `/api/draft`, and `/api/send` are deliberately bounded provider adapters.
- Resend webhook signatures are verified, and a deduplicating Convex mutation exists.

### Not production-complete

- `/workspace` reads `lib/demo-data.ts`; its campaign controls, matches, drafts, and activity are preview-only.
- Discovery and drafting are stateless Next.js request/response calls. Results are not durably reviewed, leased, retried, or connected to a campaign.
- The current schema describes the destination but lacks workflow runs, steps, leases, provider usage, approval snapshots, delivery attempts, and normalized delivery state.
- Campaign queries accept an organization ID and message approval accepts a browser-supplied actor ID. Production functions must derive both from authenticated membership.
- Search results are not normalized, entity-resolved, deduplicated, freshness-checked, or persisted as evidence.
- A caller supplies `approved`, `isSuppressed`, and other send facts to `/api/send`. In production, the server must derive every gate from Convex immediately before delivery.
- Verified Resend events are not yet written from the public webhook route into message state and suppressions.
- There is no durable daily/domain throttle, retry policy, reconciliation process, reply workflow, or global emergency pause.

Therefore, adding the E2B SDK directly to `/api/discover` would only move the stateless request into a VM. It would not create a real outreach pipeline. The Next.js provider routes should eventually become thin compatibility/BFF routes or be retired after the browser uses the authenticated FastAPI API.

## Target topology

```text
Authenticated operator
  -> Next.js UI sends authenticated request to FastAPI
  -> FastAPI forwards the user identity to Convex
  -> Convex mutation validates membership, policy, budget, and campaign state
     -> writes workflow run + first pending step atomically

FastAPI dispatcher
  -> claims a pending step through an atomic Convex lease
  -> creates a secure E2B sandbox from a pinned Python template
  -> attaches opaque run/step metadata
  -> starts one allowlisted worker command and returns

E2B worker
  -> lease one immutable, scoped job bundle
  -> call narrow FirstContact provider proxies
  -> process untrusted sources in an isolated workspace
  -> validate output against the shared contract
  -> submit artifact + usage + evidence manifest

FastAPI worker callback
  -> authenticate short-lived run token
  -> validate size, schema, run, step, attempt, and artifact digest
  -> Convex mutation commits result idempotently
  -> mutation schedules the next step or records a visible blocker

Human review
  -> approves an exact recipient + exact rendered message + evidence snapshot

FastAPI delivery worker + Convex atomic dispatch mutation
  -> atomically rechecks campaign state, approval hash, suppression,
     jurisdiction, source freshness, daily/domain limits, and global pause
  -> records a delivery attempt
  -> calls Resend with a stable idempotency key
  -> persists provider result

FastAPI Resend webhook / inbound reply
  -> verify signature and deduplicate event
  -> update message state and create immediate suppression where required
  -> expose the result to the operator
```

Business completion must come from the authenticated worker result protocol. E2B lifecycle webhooks are useful for cost and failure reconciliation, but a `sandbox.lifecycle.killed` event does not prove that a research or drafting step completed.

### FastAPI service shape

Use one Python package with explicit boundaries:

```text
services/api/
  app/main.py                 FastAPI construction and lifespan
  app/api/                    authenticated product endpoints
  app/auth/                   OIDC/JWT verification and principal mapping
  app/convex/                 typed Convex gateway; no direct calls elsewhere
  app/orchestration/          workflow dispatcher, leases, retries, reconciliation
  app/e2b/                    templates, sandbox policy, execution adapter
  app/providers/              Exa, OpenAI, Resend replaceable adapters
  app/addons/                 capability manifests and implementations
  app/policy/                 generated contracts plus server-side gate composition
  app/webhooks/               E2B and Resend signature verification
  app/observability/          redacted logs, traces, usage and cost
  worker.py                   durable dispatcher/worker process entrypoint
```

The web process handles short API requests, Server-Sent Events or WebSocket progress, callbacks, and webhooks. The worker process handles dispatch, E2B lifecycle, retries, delivery, and reconciliation. Scale them independently.

For user-initiated operations, FastAPI should pass the user's OIDC token to the Convex Python client so Convex functions can derive identity with `ctx.auth.getUserIdentity()`. Background jobs use narrowly scoped service mutations protected by a server-only secret. Never give a Convex deploy/admin key to E2B.

`lib/domain.ts` remains the canonical product validation contract. Export versioned JSON Schema from it and generate or validate matching Pydantic models in FastAPI; CI must fail when the TypeScript and Python contract digests diverge.

## Outreach workflow

### 1. Intake and campaign policy

An authenticated organization owner activates a reviewed startup profile and creates a campaign. The campaign stores a versioned policy snapshot:

- objective and capital path;
- allowed capital types, stages, sectors, and geographies;
- excluded firms, domains, jurisdictions, and conflict categories;
- public facts approved for outreach;
- research and model budgets;
- daily and per-domain delivery caps;
- source freshness window;
- sender identity and monitored reply address;
- jurisdiction decision or explicit block; and
- global and campaign pause state.

Creating a campaign does not start outreach. A separate mutation records `campaign.start_requested`, checks owner authorization, and creates a workflow run.

### 2. Firm discovery

The first E2B step builds several bounded searches from the campaign policy. Prefer official firm sites, fund pages, regulator records, portfolio pages, and recognized institutional sources. Exa's Search API currently supports `company` and `people` categories, bounded result counts, contents/highlights, moderation, request IDs, and a cost breakdown. Persist the request ID, query version, cost, URL, title, capture time, content hash, and relevant excerpt.

Discovery produces **source candidates**, never contacts and never send authorization.

### 3. Retrieval and hostile-content handling

Treat every fetched page as adversarial data. The worker must:

- keep fetched content in a data-only directory;
- never execute scripts or instructions found in a page;
- strip active content and normalize text before model use;
- cap bytes, redirects, pages per domain, and total sources per run;
- reject private, loopback, link-local, credential-bearing, and unsupported URLs;
- retain only the excerpts needed to support a claim; and
- return a visible blocker when evidence is insufficient.

No source text may gain tool authority. It cannot change the worker command, network policy, callback destination, campaign scope, or approval state.

### 4. Entity normalization and deduplication

Normalize canonical URL, registrable domain, firm name, fund or vehicle, geography, stage, sector, check size, capital instrument, current mandate, and contact channel. Use deterministic keys first, then model-assisted comparison only for ambiguous records.

Fund-level mandates matter: one firm can operate vehicles with different stages, geographies, check sizes, and control requirements. Store claims independently with source and verification timestamps rather than flattening all evidence into one thesis string.

Named people are not automatically contactable. Prefer official application routes and generic business inboxes. Any personal contact remains `unknown` or `named_business` until its source, role, jurisdiction, necessity, and lawful basis are reviewed.

### 5. Eligibility and ranking

Apply hard gates before ranking:

- stage, geography, sector, capital type, check-size, and vehicle constraints;
- source freshness and minimum evidence coverage;
- contactability and jurisdiction status;
- campaign exclusions, prior outcome, conflict, and suppression state.

Then run the transparent matcher from `lib/matching.ts`. A model may extract fields and propose additional reasons or risks, but it must not overwrite deterministic facts, hide missing evidence, or turn inference into a verified claim. Store scoring version, prompt version, model, evidence IDs, and every reason/risk.

### 6. Evidence-constrained drafting

Draft only for shortlisted, reviewed matches. The job bundle should contain only:

- outreach-approved founder facts;
- reviewed recipient and firm fields;
- cited mandate evidence;
- campaign tone and length constraints; and
- a list of forbidden or unresolved claims.

Output is strict JSON: subject, plain-text body, source claim IDs, claims requiring verification, and a factual coverage report. A deterministic validator rejects uncited numbers, unsupported names, fake referrals, urgency, exclusivity, or changed sender identity.

### 7. Human approval

Approval is an immutable snapshot over:

```text
campaign policy version
+ recipient identity and address
+ rendered subject and body
+ evidence/claim IDs and source freshness
+ jurisdiction decision
+ sender identity and unsubscribe target
```

Hash the canonical snapshot. Editing any component invalidates approval. Each follow-up is a new message and requires its own approval; there is no blanket sequence approval or unattended auto-send.

### 8. Delivery

E2B must never receive a Resend key or a callable capability that can deliver arbitrary email.

At the scheduled delivery time, the FastAPI worker requests an atomic Convex lease that recalculates policy from authoritative records. It must not trust boolean values supplied by a browser, FastAPI request payload, or E2B. The FastAPI Resend adapter then sends using `message-send/{messageId}/{approvalVersion}` as the stable local idempotency basis, stores the provider ID, and finalizes state through a Convex mutation.

Resend currently documents a default team-wide limit of five requests per second and 24-hour idempotency-key retention. FirstContact needs its own permanent delivery-attempt ledger because provider deduplication is not permanent. Start with a much lower product cap and a per-recipient-domain interval; high throughput is not the goal.

### 9. Events, replies, and suppression

The public FastAPI webhook route verifies the raw signature, uses `svix-id` for deduplication, and records normalized events in Convex. At minimum:

- `email.delivered` -> delivered;
- `email.bounced` -> failed and suppress immediately for a permanent bounce;
- `email.complained` -> complained and suppress immediately;
- `email.suppressed` -> suppressed locally;
- `email.delivery_delayed` -> retain as pending and reconcile; and
- inbound reply -> create a conversation item for a human, never generate an automatic reply.

Unsubscribe must be a first-party, one-step mutation that writes suppression before returning success. Suppression checks happen at approval and atomically again at dispatch.

### 10. Learning without optimizing for spam

Measure a quality funnel, segmented by campaign policy and scoring version:

```text
sources reviewed
  -> firms with sufficient evidence
  -> hard-gate eligible matches
  -> operator-shortlisted matches
  -> drafts approved without factual edits
  -> delivered messages
  -> substantive replies
  -> meetings / diligence / pass reason
```

Primary metrics are evidence coverage, stale-source rate, reviewer acceptance, factual edit rate, delivery rate, bounce rate, complaint rate, suppression latency, substantive reply rate, meeting rate, time to qualified shortlist, cost per reviewed match, and cost per substantive reply. Do not optimize on message volume, fabricated activity, or open pixels. Keep all conversion assumptions labeled until real outcomes exist.

## E2B worker design

FastAPI should use the E2B Python SDK. That keeps the orchestrator, add-on contracts, evaluation harness, and sandbox worker ecosystem in one language while allowing each sandbox to run Python, Node, browser automation, document tooling, or purpose-built binaries when explicitly enabled.

### Sandbox strategy

Use one fresh sandbox per workflow step or small homogeneous batch. Build it from a versioned template containing the pinned worker bundle and dependencies. This gives stronger isolation and reproducibility than one long-lived campaign sandbox.

Recommended defaults:

- secure access enabled;
- public inbound traffic disabled;
- outbound network restricted to the FirstContact worker gateway and explicitly required source/provider domains;
- short timeout with kill-on-timeout for normal jobs;
- opaque metadata only: environment, run ID, step ID, attempt, template version;
- no founder narrative, email address, secrets, or access token in metadata;
- bounded CPU, memory, disk, stdout, artifact bytes, and command duration; and
- unconditional kill after terminal result submission.

Pause/resume preserves filesystem and memory and can be useful for an operator-inspected research session, but it should not be the normal queue mechanism. Paused sandboxes are retained until killed, so relying on them creates privacy, retention, cost-accounting, and cleanup risk. Snapshots are appropriate for promoting a tested worker image, not for persisting campaign state.

### Command boundary

The FastAPI orchestrator may execute exactly one fixed entrypoint, for example:

```text
/opt/firstcontact/bin/worker --run <opaque-id> --step <opaque-id> --attempt <n>
```

Do not let a model construct shell commands. The template owns the executable and allowed tools. The worker writes only beneath its assigned workspace and returns only documented artifact types.

### Secret boundary

E2B documents that command environment variables are not private within the sandbox OS. Therefore:

- keep `E2B_API_KEY`, Convex deployment credentials, Resend credentials, auth secrets, and webhook secrets outside every sandbox;
- issue a single-use, short-lived, run-and-step-scoped FastAPI worker token;
- use narrow FastAPI provider proxies so Exa/OpenAI secrets also remain outside the sandbox;
- bind the token to allowed operations, byte limits, call counts, and expiry;
- store only a token hash in Convex and never log the raw value; and
- revoke the lease on success, timeout, cancellation, or campaign pause.

The FastAPI worker gateway returns only the minimum immutable job bundle. It rejects cross-organization IDs even when a valid token is presented.

### Result protocol

Every result envelope should contain:

```ts
type WorkerResultEnvelope = {
  runId: string;
  stepId: string;
  attempt: number;
  templateVersion: string;
  workerVersion: string;
  status: "succeeded" | "blocked" | "failed";
  outputType: "discovery" | "evidence" | "normalization" | "matching" | "draft";
  artifactSha256: string;
  artifact: unknown;
  sourceManifest: Array<{ url: string; capturedAt: number; contentSha256: string }>;
  usage: { durationMs: number; providerCalls: number; inputBytes: number; outputBytes: number };
  blocker?: { code: string; safeMessage: string; retryable: boolean };
};
```

Define the canonical schemas in `lib/domain.ts`, export versioned JSON Schema, and generate/check the Pydantic equivalents used by FastAPI and the E2B worker. The FastAPI gateway validates the envelope again before calling Convex. The commit mutation accepts the first matching terminal result for `(stepId, attempt, artifactSha256)` and treats duplicates as success. A late result from an expired lease is recorded for diagnosis but cannot advance the workflow.

### Failure and reconciliation

Assume at-least-once execution and ambiguous network failures.

- A step has `pending -> leased -> running -> succeeded | blocked | failed | cancelled` transitions.
- Leases expire and may be reclaimed with an incremented attempt.
- Provider calls use stable operation IDs and record request IDs and cost.
- The FastAPI dispatcher watchdog marks timed-out attempts through Convex and applies bounded exponential backoff with jitter.
- Retry only classified transient failures; invalid data, missing evidence, exhausted budget, policy blocks, and authentication failures require resolution.
- E2B lifecycle webhooks are signature-verified and deduplicated, then correlated by opaque metadata.
- A FastAPI reconciliation worker compares active Convex leases with E2B sandbox state and kills orphans.
- Campaign pause cancels unscheduled work, revokes active leases, and prevents new delivery. Global pause supersedes every campaign.

## Convex data-model changes

Keep the existing domain tables and add or extend the following concepts before connecting E2B:

| Record | Required fields / purpose |
|---|---|
| `workflowRuns` | organization, campaign, type, status, policyVersion, requestedBy, budget, usage, timestamps |
| `workflowSteps` | run, kind, status, attempt, lease expiry, idempotency key, input/output digest, blocker, timestamps |
| `workerLeases` | step, token hash, sandbox ID, template/worker version, expiry, revoked time |
| `artifacts` | step, type, validated payload or file reference, SHA-256, byte size, retention class |
| `sourceClaims` | source, investor/fund, field, value, excerpt, confidence, captured/verified/expiry times, reviewer |
| `fundVehicles` | firm, mandate, stage, geography, instrument, check range, active period, evidence IDs |
| `campaignPolicies` | immutable versioned policy and jurisdiction snapshot |
| `approvals` | exact message snapshot hash, approver identity, evidence version, expiry/revocation |
| `providerOperations` | provider, operation ID, request ID, status, attempts, cost/usage, response digest |
| `deliveryAttempts` | message, approval version, lease, provider ID, idempotency key, status, timestamps |
| `messageEvents` | normalized webhook/reply event with provider event ID and event time |
| `campaignCounters` | transactional daily/domain/budget counters used by pre-send policy |
| `systemControls` | environment-wide outbound pause, reason, actor, and audit time |

Also:

- add `organizationId` to every tenant-owned record that currently reaches it only through joins where doing so improves authorization and indexes;
- store approval expiry and invalidation reason on messages;
- store a suppression scope and normalized hash algorithm version;
- replace raw webhook payload retention with a short-lived raw record plus durable normalized event; and
- index queue reads by status/available time and reconciliation reads by lease expiry/sandbox ID.

All state transitions must be internal or identity-authorized Convex mutations. Never accept an actor ID, organization authority, policy result, or suppression result from the browser or worker.

## FastAPI API and provider gateway

Version the backend under `/v1`. The browser-facing endpoints include:

| Endpoint | Purpose |
|---|---|
| `POST /v1/campaigns` | Create a policy-bound campaign after identity and membership validation |
| `POST /v1/campaigns/{id}/runs` | Record a workflow request; never start work without persisted intent |
| `POST /v1/campaigns/{id}/pause` | Revoke future work and delivery leases |
| `GET /v1/runs/{id}` | Read durable progress and blockers |
| `GET /v1/runs/{id}/events` | Stream state changes from authoritative Convex records |
| `POST /v1/messages/{id}/approve` | Approve an exact versioned snapshot |
| `POST /v1/messages/{id}/revoke` | Revoke approval before delivery |
| `POST /v1/suppressions` | First-party manual objection/suppression path |
| `GET /v1/artifacts/{id}` | Authorize and stream a generated report/export |

The worker/provider routes are server-to-server boundaries, not public product APIs:

These are server-to-server boundaries, not public product APIs:

| Endpoint | Purpose |
|---|---|
| `POST /internal/v1/worker/lease` | Exchange a one-time step token for a minimal job bundle |
| `POST /internal/v1/worker/provider/exa-search` | Policy- and budget-limited Exa call |
| `POST /internal/v1/worker/provider/exa-contents` | URL-validated, byte-limited evidence retrieval |
| `POST /internal/v1/worker/provider/model` | Schema-locked model call for an allowed task/version |
| `POST /internal/v1/worker/result` | Validate and commit a result envelope |
| `POST /webhooks/v1/e2b` | Verify/deduplicate lifecycle events for reconciliation only |
| `POST /webhooks/v1/resend` | Verify/deduplicate delivery events and update state/suppression |

Each internal route checks token hash, expiry, run/step/attempt binding, campaign state, organization budget, method, schema, and body size. Responses exclude unrelated tenant data and provider secrets.

## Add-ons and output expansion

FastAPI plus E2B creates a clean extension model. An add-on is a versioned capability manifest, not arbitrary code with platform authority:

```py
class AddonManifest(BaseModel):
    key: str
    version: str
    input_schema_version: str
    output_schema_version: str
    allowed_tools: list[str]
    network_profile: str
    max_runtime_seconds: int
    max_output_bytes: int
    required_approvals: list[str]
    provider_budget_usd: float
```

Useful bounded add-ons include:

- investor mandate dossiers with source manifests;
- fund/vehicle comparison matrices;
- official contact-path verification;
- source freshness monitors;
- founder narrative and pitch-deck consistency audits;
- multilingual draft variants for human review;
- CSV, PDF, and evidence-pack exports;
- deliverability and domain-readiness preflight;
- reply classification and suggested next actions, without automatic replies;
- campaign evaluation reports and prompt/model comparison; and
- capital-path modules for grants, DFIs, credit, growth equity, PE, or strategic buyers.

Each add-on receives only approved fields, has its own egress/tool/budget policy, returns a validated artifact manifest, and cannot approve or send. Large artifacts should be uploaded to an authorized object/file store and referenced from Convex by digest, size, media type, retention class, and access policy rather than inserted as large database documents.

### Optimization strategy

More output should come from controlled parallelism and reuse, not unbounded agent loops:

- fan out independent source or firm jobs across short-lived E2B sandboxes, then reduce deterministically;
- batch sources by registrable domain to reduce fetch overhead while preserving tenant/run isolation;
- cache evidence by canonical URL, content hash, policy scope, and freshness deadline;
- use prebuilt E2B templates and start/ready snapshots to remove dependency startup time;
- route cheap extraction/classification separately from higher-reasoning evaluation;
- stream progress from FastAPI while durable truth remains in Convex;
- stop early when hard gates fail or evidence coverage is already sufficient;
- enforce per-run concurrency, provider-call, token, byte, time, and dollar ceilings; and
- benchmark with a fixed evaluation corpus before changing templates, prompts, models, or parallelism.

This allows substantially richer research and export output while keeping cost, provenance, and failure behavior measurable.

## Delivery performance and safety budgets

Initial private-beta defaults should be deliberately small and configuration-owned:

- one active research run per organization;
- bounded sources and model calls per run;
- no delivery until a complete staging event/suppression test passes;
- at most 5 approved sends per organization per day initially;
- at most 1 first-contact message to a recipient domain in a configurable interval;
- no automatic follow-up;
- automatic pause on any complaint, suppression-processing failure, global webhook outage, authorization anomaly, budget breach, or unexpectedly high bounce rate; and
- manual review before resuming.

The numerical defaults are operational starting points, not legal conclusions or performance promises. Make them stricter where jurisdiction, consent, domain reputation, or operator capacity requires it.

## Implementation sequence

### Phase 0 — contracts and authorization

1. Scaffold `services/api` with FastAPI, Pydantic settings, structured logging, health/readiness endpoints, and separate API/worker entrypoints.
2. Add the workflow, worker-result, evidence-claim, policy, approval, delivery, and normalized-event schemas to `lib/domain.ts`, export JSON Schema, and verify generated Pydantic models in CI.
3. Implement real founder/operator authentication and identity-derived organization membership across FastAPI and Convex.
4. Replace browser-supplied actor and policy fields in campaign and delivery mutations.
5. Add global pause, campaign pause, immutable policy versions, budget counters, and an audit-event helper.

Exit gate: cross-tenant tests, transition tests, and policy-invalidation tests pass without E2B or provider credentials.

### Phase 1 — durable local orchestration

1. Add workflow run/step/lease/artifact/provider-operation tables and indexes.
2. Implement FastAPI endpoints that record intent through identity-authenticated Convex mutations.
3. Implement the separate dispatcher process, atomic leasing, watchdog, retry, and reconciliation loops without relying on in-memory tasks.
4. Build a local fake worker that uses the exact worker protocol and fixtures.
5. Wire `/workspace` to FastAPI/Convex state while preserving an explicit preview mode.

Exit gate: kill, duplicate callback, timeout, retry, pause, cancellation, and budget-exhaustion tests prove that state cannot skip a gate.

### Phase 2 — E2B research worker

1. Add the pinned E2B Python SDK and a versioned Python template definition.
2. Build the fixed Python worker entrypoint and FastAPI internal worker gateway.
3. Enable secure access, restricted egress, size/time/resource limits, cleanup, lifecycle webhook verification, and orphan reconciliation.
4. Move discovery, retrieval, normalization, and deterministic matching into sandbox jobs.

Exit gate: a staging campaign creates durable, source-backed, deduplicated matches; injected source instructions cannot alter tools or state; no sandbox retains secrets or tenant data after cleanup.

### Phase 3 — drafting and review

1. Add the model proxy, prompt registry, structured result validation, and evaluation fixtures.
2. Persist draft claims and exact approval snapshots.

Exit gate: the evaluation set has zero invented contacts/referrals/metrics, every factual claim maps to approved founder data or a current source, and any edit invalidates approval.

### Phase 4 — delivery and learning

1. Replace `/api/send` browser-shaped input with a FastAPI delivery worker that derives every gate from Convex state.
2. Terminate and verify Resend webhooks in FastAPI, then persist normalized message events, replies, and immediate suppressions in Convex.
3. Add reconciliation, emergency-pause drills, operator dashboards, alerts, and quality-funnel metrics.
4. Run a synthetic staging campaign, then an explicitly authorized closed pilot at the initial cap.

Exit gate: duplicate and ambiguous sends cannot create a second email; unsubscribe, bounce, complaint, webhook outage, provider 429, and emergency pause are exercised end to end.

## Verification plan

Every phase must keep the repository handoff gate:

```bash
bun run typecheck
bun run test
bun run lint
bun run build
git diff --check
```

Add a Python gate once `services/api` exists:

```bash
uv run ruff check services/api
uv run mypy services/api
uv run pytest services/api
```

Add focused suites for:

- authorization and cross-tenant isolation;
- every workflow and campaign transition;
- lease expiry, duplicate result, late callback, retry, cancellation, and reconciliation;
- URL and egress policy, prompt injection, oversized artifacts, malformed provider output, and secret redaction;
- deterministic normalization, deduplication, fund-level matching, source freshness, and scoring-version stability;
- approval snapshot hashing and invalidation;
- suppression races, daily/domain counters, provider idempotency, ambiguous delivery, and webhook deduplication;
- global/campaign pause and budget exhaustion; and
- preview mode never writing or presenting itself as live.

Use provider contract tests with recorded synthetic fixtures. Live-provider tests belong in an isolated staging deployment and must use provider-supported test recipients or explicitly authorized addresses, never fabricated contacts.

## Research basis

- [E2B sandbox overview and runtime limits](https://e2b.dev/docs/sandbox)
- [E2B Python SDK](https://e2b.dev/docs/sdk-reference/python-sdk/v2.15.0/sandbox_sync)
- [E2B template start and ready commands](https://e2b.dev/docs/template/start-ready-command)
- [E2B persistence and pause/resume behavior](https://e2b.dev/docs/sandbox/persistence)
- [E2B secure sandbox access](https://e2b.dev/docs/sandbox/secured-access)
- [E2B create-sandbox network controls](https://e2b.dev/docs/api-reference/sandboxes/create-sandbox)
- [E2B sandbox environment variables](https://e2b.dev/docs/sandbox/environment-variables)
- [E2B lifecycle events and webhook verification](https://e2b.dev/docs/sandbox/lifecycle-events-webhooks)
- [E2B metrics](https://e2b.dev/docs/sandbox/metrics)
- [E2B pricing and concurrency](https://e2b.dev/pricing)
- [Convex actions and durable scheduling](https://docs.convex.dev/functions/actions)
- [Convex workflow guidance](https://docs.convex.dev/agents/workflows)
- [Convex Python client quickstart](https://docs.convex.dev/quickstart/python)
- [Convex service authentication](https://docs.convex.dev/auth/overview#service-authentication)
- [Convex HTTP API](https://docs.convex.dev/http-api/)
- [Exa Search API](https://exa.ai/docs/reference/search)
- [Exa Contents API](https://exa.ai/docs/reference/get-contents)
- [Resend usage limits](https://resend.com/docs/api-reference/rate-limit)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Resend webhook event types](https://resend.com/docs/webhooks/event-types)

Provider features, limits, and prices can change. Recheck them before capacity planning or production activation.
