---
name: firstcontact
description: "Working rules for the FirstContact repo: the two-sided founder/investor loop, the disclosure gates that must never loosen, the honesty rule about fabricated data, and the six-command verification gate every change must pass. Use whenever changing anything in this repository — Convex functions, React components, retention, auth, outreach policy, or docs — and especially before claiming a change is done."
---

# FirstContact

An open-source fundraising discovery and outreach platform. This skill records
the invariants that are easy to break and expensive to discover later. The
Convex-specific `convex-*` skills cover *how* to write Convex; this covers what
this particular product may and may not do.

## The verification gate

A change is not done until all six pass. Run them; do not assume.

This project uses **bun** (`packageManager: bun@1.3.14`). Use the package
scripts rather than invoking the tools directly — they are what CI runs.

```bash
bun run typecheck            # 1  tsc --noEmit
bun run lint                 # 2  eslint .
bun run test                 # 3  vitest run
bun run build                # 4  next build (static export)
bun audit --audit-level=high # 5  fails on high+ advisories
bun run api:check            # 6  ruff + mypy + pytest for services/api
```

`bun run check` chains 1–4 in one command, but a split run names the stage that
broke. Never reach for `npm`/`npx` here: the lockfile is `bun.lock`, CI installs
with `bun install --frozen-lockfile`, and a stray `npm install` would write a
`package-lock.json` that nothing reads and that CI's lockfile job would flag.

These mirror the six CI jobs exactly. Report failures with their output rather
than describing them.

`convex/_generated/` is committed and regenerated automatically by a PostToolUse
hook after any edit under `convex/`. If types look stale, run
`bunx convex codegen --typecheck disable` — but check the hook first.

## The product's non-negotiables

These are policy, not preference. Loosening any of them silently is the worst
failure mode this codebase has.

### 1. Never fabricate data

No sample investors, no example companies, no placeholder metrics that read as
real. An unconfigured capability reports itself unconfigured; an empty table
renders an empty state. Fictional records live only in `scripts/seed-dev.mjs`,
which refuses to run against a non-`dev:` deployment.

A metric that cannot be measured returns an empty array, not an estimate. See
`investors.myActivity`, where `investedAt` is deliberately empty.

### 2. Automation may draft, never send

Research, ranking and drafting can be automated. Approval cannot. No code path
may bypass the approval, suppression, jurisdiction, source, sender-identity,
unsubscribe or rate-limit gates. Outbound email stays disabled behind
`OUTBOUND_EMAIL_ENABLED` until the compliance work is done.

**Exception, and it matters:** *transactional* mail — password reset, address
verification, operator alerts — is deliberately NOT gated by that switch.
Holding a password reset behind the outreach kill switch would lock users out
of their own accounts. Suppression lists are not consulted for it either.

### 3. Publication is consensual and reversible

The catalogue lifecycle is `private → review → listed`. A founder controls
entry and exit — including immediate, unconditional withdrawal of a published
listing. An operator controls only the middle transition and can never publish
a draft that was not submitted. Editing a live listing returns it to review.

### 4. Contact details are released only on acceptance

An investor expressing interest reveals their name and note, nothing more. The
investor's email reaches the founder only when the founder accepts; the
company's website reaches the investor only then. Both are pinned by tests in
`tests/convex-catalogue.test.ts` — if you change the shape of those queries,
those tests are the specification.

### 5. Authorization is server-side, always

The static export means client-side gates are UX affordances, not security.
Every Convex function enforces its own authorization via `convex/authz.ts`.
`admin` can never be self-assigned. Admin access needs per-session TOTP step-up,
not merely the admin role.

### 6. Privacy-preserving storage

Raw IPs are never stored — they are HMAC-keyed with `RATE_LIMIT_SECRET`, and the
public write endpoints fail closed (503) without it. Suppressions store a hash,
not an address. Error diagnostics are redacted by `lib/redaction.ts` *before*
storage, never on read, and carry no user id.

### 7. Retention deletes narrowly and never touches evidence

Unsuccessful signups expire 24 months after last contact. Never swept:
`invited`/`active` records, records claimed by an account, audit logs, and above
all **suppressions** — deleting one silently re-permits contacting someone who
opted out. Only counts are recorded, never which records were deleted.

## Where things live

| Concern | File |
|---|---|
| Shared validation contract | `lib/domain.ts` |
| Authorization helpers | `convex/authz.ts` |
| Catalogue lifecycle + founder inbox | `convex/catalogue.ts` |
| Investor interest | `convex/investors.ts` |
| Auth config, reset, verification | `convex/auth.ts`, `convex/authEmail.ts` |
| Error capture and alerting | `convex/observability.ts`, `lib/redaction.ts` |
| Retention sweep | `convex/maintenance.ts` |
| Provider chains (LLM, search, email) | `lib/providers.ts`, `convex/providers.ts` |
| Operational procedures | `docs/RUNBOOKS.md` |
| Privacy posture and open decisions | `docs/DATA_PROTECTION.md` |
| Honest state of the project | `docs/LAUNCH_READINESS.md` |

## Traps this codebase has already hit

- **Circular type inference.** A Convex action that calls mutations in its own
  module through `internal` needs an explicit return type annotation. Without
  it, the generated `api` type silently degrades to `any` across the *entire*
  app. If components suddenly show `implicitly has an 'any' type`, look here.
- **Removing a table from the schema does not delete its rows.** They persist,
  unreachable from code, and land in every backup. See `docs/RUNBOOKS.md` §7.
- **Adding a Convex module requires codegen** before `api.<module>` typechecks.
- **Onboarding links must point at routes that exist.** `tests/onboarding.test.ts`
  asserts this; it was added because both roles' first action was a 404.
- **Dependency overrides must name the *fixed* version.** A pin one patch below
  the advisory's fix silently reintroduces the vulnerability while looking
  deliberate.

## Documentation honesty

`docs/LAUNCH_READINESS.md` distinguishes what is shipped from what is assumed.
When a claim there stops being true, fix it in the same change — stale
readiness documentation is worse than none, because it is trusted. The same
applies to `README.md` and the `/system` page, both of which have previously
described removed subsystems as current.

Mark operator decisions that only a human can make with `[OPERATOR: ...]` rather
than inventing a plausible answer.
