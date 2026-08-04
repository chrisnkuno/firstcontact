# Deployment

## FastAPI workflow backend

The Next.js deployment does not run the Python workflow service. Deploy `services/api` as a separate long-running FastAPI service plus a separate dispatcher/worker process from the same package.

Required server-only variables are `CONVEX_URL`, `WORKFLOW_ACTION_SECRET`, and `FASTAPI_SERVICE_TOKEN`. User workflow routes additionally require `OIDC_ISSUER_URL` and `OIDC_AUDIENCE`, configured identically for FastAPI and Convex. Set the same `WORKFLOW_ACTION_SECRET` in the Convex deployment. To activate sandbox research, also set `EXECUTION_MODE=e2b`, `E2B_API_KEY`, a reviewed `E2B_TEMPLATE` ID, `WORKER_GATEWAY_URL`, and `EXA_API_KEY`. Never use `NEXT_PUBLIC_*` for these values.

The API process runs `uvicorn app.main:app`; the continuous worker process runs `python -m app.worker` with graceful SIGINT/SIGTERM shutdown. `python -m app.worker --once` is available for scheduled dispatch or smoke tests. Expired leases and user cancellation trigger best-effort E2B cleanup; signed E2B lifecycle webhooks and an external orphan-cleanup runbook are still required for production defense in depth.

`services/api/Dockerfile` builds the shared API/worker image from the locked Python dependency graph. Deploy the default command for the API and override it with `python -m app.worker` for the dispatcher. The API is the only process that needs inbound traffic.

Probe `/healthz` for liveness and `/readyz` for required provider readiness. Keep `EXECUTION_MODE=disabled` until the E2B template and data-retention path have been reviewed.

The maintained deployment is available at [firstcontact-tau.vercel.app](https://firstcontact-tau.vercel.app). The signup path uses Convex persistence, while catalogue, workspace, investor discovery, drafting, and outreach remain explicitly labeled preview or blocked until their respective production controls are configured.

## Environments

Maintain separate `development`, `staging`, and `production` Convex deployments, provider keys, Resend domains, and webhook secrets. Never use production contact data for local testing.

## 1. Application

```bash
bun install --frozen-lockfile
bun run check
```

Deploy the Next.js app to Vercel or another Node.js 22-compatible host. Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin.

## 2. Convex

```bash
bunx convex dev
bunx convex deploy
```

The first command creates a development project and generates `convex/_generated`.
**Commit those generated files** — TypeScript and `convex-test` need them, and CI
does not run `convex codegen` (that requires a live deployment). Configure
authentication following the current [Convex Auth documentation](https://docs.convex.dev/auth)
and enforce membership checks described in the architecture document before
enabling private account data.

For public signup ingestion, generate a high-entropy secret and set the identical value on both runtimes:

```bash
bunx convex env set SIGNUP_INGEST_SECRET
vercel env add SIGNUP_INGEST_SECRET production
vercel env add CONVEX_URL production
```

The Next.js route validates and rate-limits submissions before invoking the secret-protected Convex mutation. Do not prefix the secret with `NEXT_PUBLIC_`.

## 3. Exa

Create an API key and set `EXA_API_KEY` server-side. The discovery adapter calls `POST https://api.exa.ai/search`, uses content highlights, and stores `requestId`. Review current [Exa Search API documentation](https://exa.ai/docs/reference/search) before changing search modes or categories.

## 4. OpenAI

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-5-nano`). The draft route uses the Responses API and a strict JSON schema. Review current [GPT-5 nano](https://developers.openai.com/api/docs/models/gpt-5-nano) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) documentation when upgrading.

## 5. Resend

1. Verify a dedicated sending subdomain with SPF and DKIM; publish DMARC.
2. Set a sender that accepts replies in `RESEND_FROM`.
3. Configure `RESEND_API_KEY`.
4. Create a webhook pointing to `https://your-origin/api/webhooks/resend` and subscribe to sent, delivered, delayed, bounced, complained, failed, and received events.
5. Set its signing secret as `RESEND_WEBHOOK_SECRET`.
6. Connect the verified route to `internal.webhooks.recordResendEvent` after Convex code generation.

Resend documents webhook event types and signature verification in its [official webhook documentation](https://resend.com/docs/webhooks/event-types).

## 6. Outbound activation

Set `OUTBOUND_API_TOKEN` to a high-entropy secret as a temporary server-to-server boundary. Replace it with identity-derived organization authorization before public production use. Keep `OUTBOUND_EMAIL_ENABLED=false` until all checks in `COMPLIANCE.md` pass in staging. Start production at a low `OUTBOUND_DAILY_LIMIT`, monitor complaints and bounces, and provide a global emergency pause. This flag is only one gate; authorization, message approval, and policy checks remain mandatory.

## Rollback

Application rollback must not roll back suppressions or audit state. Pause campaigns first, roll back stateless application code, verify webhook ingestion, and then resume only after checking queued messages for duplicates.
