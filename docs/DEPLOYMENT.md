# Deployment

FirstContact is a **statically exported Next.js site on GitHub Pages** with
**Convex as its only backend**, plus a separately hosted **FastAPI workflow
service** for sandboxed investor research.

There is no Node server in production. Everything that used to be a Next.js API
route is now a Convex function.

```
GitHub Pages (static HTML/JS)  ──►  Convex  ──►  FastAPI + E2B worker
   marketing, dashboards            auth, data,      sandboxed research
                                    HTTP endpoints
```

## What this architecture costs

Stating it plainly, because it is a real trade rather than a neutral change:

| Control | Before (Node host) | Now (GitHub Pages) |
|---|---|---|
| Session storage | HttpOnly cookie | Browser `localStorage` (Convex Auth) |
| `Strict-Transport-Security` | Set by the app | Not settable; `*.github.io` is HSTS-preloaded, custom domains need a fronting CDN |
| `X-Frame-Options` | Set by the app | Gone; meta CSP `frame-ancestors` is not enforced from a meta tag either |
| `X-Content-Type-Options`, `Permissions-Policy`, COOP/CORP | Set by the app | No meta equivalent — accepted loss |
| `Content-Security-Policy` | Response header | `<meta http-equiv>` in `app/layout.tsx` |
| `Referrer-Policy` | Response header | `<meta name="referrer">` |

The compensating controls are that every Convex function enforces its own
authorization, admin access additionally requires per-session TOTP step-up, and
the codebase has no HTML-injection sink (no `dangerouslySetInnerHTML`, no
`eval`, no third-party script origins). See `docs/SECURITY.md`.

If these losses are unacceptable for your deployment, host the same build on any
Node 22 host instead — nothing in the application depends on Pages specifically.

## 1. Convex

```bash
bunx convex dev      # creates a dev deployment and generates convex/_generated
bunx convex deploy   # production
```

Commit `convex/_generated` — TypeScript and `convex-test` need it, and CI does
not run codegen (that requires a live deployment).

Set the deployment environment:

```bash
bunx convex env set SITE_ORIGIN https://chrisnkuno.github.io
bunx convex env set RATE_LIMIT_SECRET "$(openssl rand -hex 32)"
bunx convex env set ADMIN_BOOTSTRAP_SECRET "$(openssl rand -hex 32)"
```

`RATE_LIMIT_SECRET` is required: the public write endpoints **fail closed**
without it, because an unmetered public write endpoint is worse than a
temporarily unavailable one.

`SITE_ORIGIN` must match the deployed site exactly, or every signup is rejected
as cross-origin. The endpoints are cross-origin by design now (the site is on
`github.io`, the endpoints on `*.convex.site`), so an explicit allowlist —
not `Sec-Fetch-Site` — is what separates friend from foe.

## 2. GitHub Pages

Set repository **variables** (Settings → Secrets and variables → Actions →
Variables). These are not secrets; they are inlined into a public bundle.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `https://your-deployment.convex.cloud` |
| `NEXT_PUBLIC_APP_URL` | the canonical site origin |
| `NEXT_PUBLIC_BASE_PATH` | `/firstcontact` for a project site; empty for a user site or custom domain |

Then enable Pages with source **GitHub Actions**. `.github/workflows/pages.yml`
builds and publishes on every push to `main`.

Two details that break the site silently if missed:

- **`.nojekyll`** — the workflow creates it. Without it, Pages runs the output
  through Jekyll, which drops every path beginning with `_`, including `_next`
  (the entire JS and CSS bundle).
- **`trailingSlash: true`** — already set in `next.config.ts`. Pages resolves
  `/path/` to `/path/index.html`; without it deep links 404.

Convex deployment is deliberately **not** part of this workflow, so a schema
change is always a reviewed act rather than a side effect of merging.

## 3. The first admin

Roles cannot be self-assigned — `admin` is rejected from any sign-up payload.

1. Create a normal account at `/join`.
2. Promote it, once, with the bootstrap secret:

   ```bash
   bunx convex run users:promoteToAdmin \
     '{"email":"you@example.com","bootstrapSecret":"<ADMIN_BOOTSTRAP_SECRET>"}'
   ```

   This path closes permanently the moment any admin exists. Afterwards, only an
   existing verified admin can promote anyone.
3. Sign in and enrol an authenticator at `/admin/mfa`. **Admin reads are refused
   until you do** — MFA is mandatory, not optional, and each session must
   complete step-up before it can read platform data.

## 4. Providers

Every integration reports itself as unconfigured rather than fabricating output.
Discovery with no `EXA_API_KEY` returns nothing and says so; it no longer returns
sample investors.

```bash
bunx convex env set OPENAI_API_KEY ...     # drafting and UI translation
bunx convex env set EXA_API_KEY ...        # investor discovery
bunx convex env set RESEND_API_KEY ...     # delivery
bunx convex env set RESEND_FROM ...
bunx convex env set RESEND_WEBHOOK_SECRET ...
```

Point the Resend webhook at `https://your-deployment.convex.site/webhooks/resend`
and subscribe to sent, delivered, delayed, bounced, complained, failed and
received. Bounces and complaints write suppressions automatically.

## 5. Outbound activation

Keep `OUTBOUND_EMAIL_ENABLED=false` until every check in `COMPLIANCE.md` passes
in staging. The flag is one gate of several — approval, suppression, contact
type, sender identity, unsubscribe and jurisdiction review are all enforced
independently in `lib/compliance.ts`, and a send is refused unless all pass.

## 6. FastAPI workflow backend

Deploy `services/api` as a long-running FastAPI service plus a separate
dispatcher/worker process from the same image (`services/api/Dockerfile`). The
API runs `uvicorn app.main:app`; the worker runs `python -m app.worker`. Only the
API needs inbound traffic.

Required: `CONVEX_URL`, `WORKFLOW_ACTION_SECRET` (identical on both runtimes),
`FASTAPI_SERVICE_TOKEN`. For sandboxed research also set `EXECUTION_MODE=e2b`,
`E2B_API_KEY`, a reviewed `E2B_TEMPLATE`, `WORKER_GATEWAY_URL` and `EXA_API_KEY`.
Keep `EXECUTION_MODE=disabled` until the template and data-retention path are
reviewed.

Probe `/healthz` for liveness and `/readyz` for provider readiness.

The research chain ends at a **human gate**: discovery writes
`researchCandidates` marked `unreviewed`, and only `research:verifyCandidate`
(owner or reviewer) promotes one into a contactable `investors` record. Nothing
downstream consumes an unverified candidate.

## Environments

Maintain separate development, staging and production Convex deployments,
provider keys, Resend domains and webhook secrets. Never use production contact
data for local testing.

`scripts/seed-dev.mjs` refuses to run against anything that is not a `dev:`
deployment — synthetic records must never reach a real pipeline, where they
would be indistinguishable from real founders in every metric.

## Rollback

Application rollback must not roll back suppressions or audit state. Pause
campaigns first, roll back the static build, verify webhook ingestion, then
resume only after checking queued messages for duplicates. A Convex schema
rollback is separate and must be considered on its own.
