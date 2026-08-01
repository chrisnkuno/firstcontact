# FirstContact FastAPI backend

This service is the implemented backend foundation for Convex-authoritative, E2B-executed outreach workflows.

## What is implemented

- FastAPI health, readiness, add-on, workflow create/read/cancel, one-shot dispatch, and worker-result endpoints.
- A separate dispatcher entrypoint (`python -m app.worker`).
- OIDC bearer forwarding for user workflow routes; Convex verifies the token and derives organization membership.
- A separate server-only service token for dispatcher/service endpoints.
- Convex HTTP gateway for durable run creation, atomic leases, running state, results, retry scheduling, cancellation, artifacts, and audit events.
- An E2B Python adapter that uploads a fixed worker and immutable job bundle, validates the returned artifact digest, and kills the sandbox in `finally`.
- A scoped Exa gateway: E2B receives only its lease token, network access is allowlisted to FastAPI, Convex atomically reserves provider budget, and sanitized source evidence is persisted as unreviewed candidates.
- Expired/cancelled leases release outstanding provider reservations and trigger orphan-sandbox cleanup.
- Pydantic request/result contracts and Python tests.

The repository can execute source-backed Exa discovery once OIDC, Convex, FastAPI, E2B, the worker gateway, and Exa are configured. It still has no browser OIDC client, verified investor/contact normalization, drafting workflow, or delivery worker, so the public product remains preview-only.

## Run locally

From the repository root:

```bash
uv sync --project services/api
bun run api:dev
```

Run the continuous dispatcher in another terminal:

```bash
bun run api:worker
```

For a scheduler or one-off smoke test, use `bun run api:dispatch`.

The API is available at `http://localhost:8000`. Interactive API documentation is enabled outside production at `/docs`.

## Required configuration

```dotenv
CONVEX_URL=https://your-deployment.convex.cloud
WORKFLOW_ACTION_SECRET=use-a-distinct-high-entropy-secret
FASTAPI_SERVICE_TOKEN=use-another-distinct-high-entropy-secret
OIDC_ISSUER_URL=https://your-issuer.example.com
OIDC_AUDIENCE=firstcontact-api
EXECUTION_MODE=disabled
```

Set the matching workflow secret in Convex:

```bash
bunx convex env set WORKFLOW_ACTION_SECRET
```

To execute E2B jobs:

```dotenv
EXECUTION_MODE=e2b
E2B_API_KEY=server-side-only
E2B_TEMPLATE=your-reviewed-template-id
WORKER_GATEWAY_URL=https://api.yourdomain.example
EXA_API_KEY=server-side-only
```

`/healthz` remains 200 and reports capabilities truthfully. `/readyz` returns 503 when required persistence or selected execution configuration is missing.

## Authorization boundaries

Dispatcher and service-only endpoints require:

```http
Authorization: Bearer <FASTAPI_SERVICE_TOKEN>
```

User workflow routes require an OIDC JWT. FastAPI forwards it to Convex and never trusts unverified claims; Convex verifies the issuer/audience and derives membership from `identity.tokenIdentifier`. The service token is rejected on these routes and must never reach browser code.

## Verification

```bash
bun run api:check
```

This runs Ruff, strict mypy, and pytest.

## Container deployment

Build one image and deploy it twice:

```bash
docker build -t firstcontact-api services/api
```

- API process: use the image default command.
- Dispatcher process: override the command with `python -m app.worker`.

Only the API process needs an inbound public route. Restrict `/internal/*` at the edge in addition to the application token, and route provider webhooks only to their dedicated future endpoints.
