# Getting started as a contributor

A practical walkthrough for your first contribution to FirstContact. For the formal rules
(PR checklist, data policy, commit style), see [CONTRIBUTING.md](../CONTRIBUTING.md). This
doc is the "what do I actually type" companion to that.

## 1. Prerequisites

- [Bun](https://bun.sh) 1.3+ (the project pins `1.3.14` via `packageManager`)
- Node.js 22.x
- A GitHub account, and `git`

## 2. Fork and clone

```bash
gh repo fork chrisnkuno/firstcontact --clone
cd firstcontact
```

(Or fork via the GitHub UI, then `git clone` your fork.)

## 3. Install and configure

```bash
bun install
cp .env.example .env.local
```

You don't need real provider credentials to work on most of the codebase. With
`.env.local` left mostly blank, the app runs in **preview mode**: the VC catalogue shows
labeled fictional data, discovery returns labeled sample matches, and outbound email stays
blocked. Provider keys (`EXA_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, Convex vars) are
only needed if you're specifically working on that integration — see
[Configure the live stack](../README.md#configure-the-live-stack) in the README.

## 4. Run it

```bash
bun run dev
```

Open http://localhost:3000. Check `/api/health` to see which providers are configured.

## 5. Find your way around

| Path | What's there |
|---|---|
| `app/` | Next.js App Router routes and pages (signup, workspace, catalogue, API routes) |
| `components/` | Shared UI components |
| `lib/` | Pure, tested logic — `domain.ts` (shared validation contract), `matching.ts`, `compliance.ts` |
| `convex/` | Convex schema, mutations/actions (`signups.ts`, `campaigns.ts`, `webhooks.ts`, `crons.ts`) |
| `tests/` | Vitest tests, mirroring `lib/` modules |
| `docs/` | Architecture, compliance, security, deployment, roadmap |

If you're touching validation, matching, or policy logic, start by reading `lib/domain.ts` —
it's the shared contract most other modules build on.

## 6. Make your change

- Small, focused branch off `main`: `git checkout -b fix/short-description`.
- For anything beyond a small fix (schema changes, new behavior), open an issue first so
  the approach can be discussed before you invest time.
- Add or update tests in `tests/` for any change to policy, matching, state transitions, or
  provider parsing — these are the modules CI leans on most.
- Keep preview/sample data visually and functionally distinct from live data; see
  [AGENTS.md](../AGENTS.md) for the guardrails this project enforces (no bypassing approval
  gates, no secrets in `NEXT_PUBLIC_*`, no invented investor/founder data).

## 7. Run the local gate before pushing

```bash
bun run check
```

This runs typecheck, tests, lint, and build — the same gate CI runs. It's faster to catch
failures here than in CI. Individual pieces, if you want tighter feedback loops:

```bash
bun run typecheck
bun run test:watch
bun run lint
```

## 8. Open the PR

Push your branch and open a PR against `main`. Fill in user impact, data impact,
verification, and rollback, and work through the checklist in
[CONTRIBUTING.md](../CONTRIBUTING.md#pull-request-checklist). CI (`.github/workflows/ci.yml`)
runs `bun run check` on every PR — it must be green before merge.

Commit subjects are short and imperative, e.g. `Add suppression preflight check`.

## 9. Where to look for context

- [Architecture and data flow](ARCHITECTURE.md)
- [Responsible outreach and privacy](COMPLIANCE.md)
- [Security and threat model](SECURITY.md)
- [Product roadmap](ROADMAP.md) — good source of ideas if you're not sure what to work on

If anything here is out of date, that's a welcome first PR.
