# Launch readiness

Assessed and updated 2026-08-20, against one specific goal: **can this platform
receive real startups and real investors, and connect them?**

The answer is now **yes, for a supervised launch**. The two-sided loop exists end
to end: a founder creates an organization, writes a listing, submits it; an
operator reviews and publishes it; an investor finds it and expresses interest;
the founder receives that interest and decides whether to release contact
details. Every step of that is implemented, authorization-checked and tested.

What remains is operational rather than structural — alerting, MFA recovery, a
restore rehearsal, and the legal decisions only a named operator can make.

## Overall score: 8.5 / 10 — ready for a supervised launch

| # | System | State | Score |
|---|---|---|---|
| 1 | Build, CI and quality gates | Green across all six jobs | 9 |
| 2 | Public intake (`/signup`) | Real, rate-limited, fails closed | 9 |
| 3 | Authorization and tenancy | Well-built, now covered by 30 Convex-backed tests | 9 |
| 4 | Authentication and identity | Reset and verification shipped | 8 |
| 5 | Startup (supply) side | Organization → profile → listing → inbox | 8 |
| 6 | Investor (demand) side | Browse, express interest, track responses | 8 |
| 7 | The two-sided loop | Closes end to end, with real disclosure gates | 8 |
| 8 | Admin operations | MFA-gated, audited, listing review added | 8 |
| 9 | Docs accuracy | README and this file corrected | 8 |
| 10 | Legal and compliance | Framework documented, operator decisions still open | 6 |
| 11 | Operations and observability | Error capture, alerting, backups, runbooks | 7 |
| 12 | Outbound email (outreach) | Disabled by design, not a gap yet | n/a |

## Verified green (run 2026-08-20, after the changes below)

Every one of these was executed, not assumed:

- `tsc --noEmit` — clean
- `eslint .` — clean
- `vitest run` — 22 files, **199 tests passed** (was 152)
- `next build` — **35 static routes** exported (was 31)
- `bun audit --audit-level=high` — clean
- `pytest services/api/tests` — **11 passed**

## What changed to get here

### CI was red; it is now green

The `nanoid` override in `package.json` pinned `3.3.17`, but advisory
GHSA-2v37-7h3g-55p8 is only fixed in `3.3.18` — so the override, whose stated
purpose is to force transitive dependencies to their *fixed* releases, was
pinning a known-vulnerable version one patch below the fix. Bumped to `3.3.18`.

### The catalogue can now be non-empty

`catalogueListings` previously had **no writer anywhere in the codebase**.
`listPublished` read it; nothing inserted into it. The catalogue was therefore
structurally incapable of ever containing anything, no matter how many founders
joined — the investor side was inert by construction.

`convex/catalogue.ts` now implements the full lifecycle:

```
private  →  review  →  listed
   ↑___________|__________|
```

The split of control is deliberate. A founder owns entry and exit — they draft,
submit, and can withdraw at any time including after publication, with no
operator involved and no way to refuse it. An operator owns only the middle
transition, and cannot publish a draft that was never submitted. Editing a live
listing returns it to review, so an approval cannot be reused to publish
different text.

### The supply side has a user interface

`organizations.*`, `profiles.*` and the listing mutations were all written,
tested and authorization-checked, with **no component calling any of them**. A
founder could create an account and then do nothing with it.

`/dashboard/organization` is now a four-step workspace: create organization →
describe the company → write the public listing → read who has been in touch.

### The loop closes

`investorInterests` rows were written and then never read by anything a founder
could see. There is now a founder inbox (`catalogue.myListingInterests`) and an
accept/decline action, with two disclosure rules pinned by tests:

- the investor's email address is released to the founder **only** on accept;
- the company website is released to the investor **only** on accept.

`investorOrganizationId` became optional, because requiring an angel to create
an organization put a toll gate in front of the one action the investor side
exists for.

### Accounts can be recovered

Password reset and email verification are implemented over the existing
multi-provider email chain, so a deployment already using Postmark or SendGrid
gets them with no extra configuration.

Both are **transactional** and deliberately *not* gated by
`OUTBOUND_EMAIL_ENABLED`, which governs outreach. Holding a password reset
behind the outreach kill switch would have locked every user out of their own
account for as long as outreach stayed disabled — precisely backwards.
Suppression lists are not consulted either: unsubscribing from outreach must
never cost someone the ability to recover their login.

Codes rather than magic links, because the site is a static export served from a
base path that varies per deployment.

### Onboarding no longer dead-ends

The checklist linked participants to `/dashboard/profile` and investors to
`/investor/profile`; **neither route existed**. Both now do, and a test asserts
that every onboarding action points at a route the app actually builds.

`hasOrganization` was also being derived from campaign count, which conflated
"has an organization" with "has run a campaign" and left the step permanently
unticked. It now reads real workspace state.

### Failures are now visible

Uncaught browser errors, React render errors and Convex function failures are
captured, **redacted before storage**, grouped by fingerprint so a repeat
increments a count rather than adding a row, and surfaced at `/admin/errors`.
An hourly cron emails `ALERT_EMAIL` when three or more distinct problems appear
within an hour, at most once per hour.

The report endpoint is unauthenticated by necessity — errors on the sign-in and
catalogue screens are exactly the ones worth knowing about, and those callers
have no session. It is bounded by a ceiling on *new* fingerprints per hour,
which lets a flood be dropped while a genuine incident keeps counting
accurately.

### Retention is real, and backups are verifiable

Unsuccessful signups are deleted 24 months after last contact — the operator's
documented decision. `invited` and `active` records, and any record claimed by
an account, are never swept; suppressions and audit logs never expire.

`scripts/backup.mjs` wraps `convex export` with a checksum, a provenance
manifest, refusal to overwrite, and a warning on a suspiciously small archive.
It was run end to end against a live deployment and the checksum verified
independently.

## Remaining gaps, ordered by cost of neglect

| Gap | Risk | Notes |
|---|---|---|
| **Orphaned pre-migration auth tables** | **High** | `adminUsers` still holds `passwordHash` and `mfaSecret` on existing deployments. Removing a table from the schema does not delete its rows, and the retention sweep cannot reach it. Purge procedure: `RUNBOOKS.md` §7 |
| Restore never rehearsed | **High** | The procedure is written and the backup tooling is proven; the drill itself has not been run |
| No self-service account deletion | **High** | Erasure is a manual dashboard procedure against a statutory deadline. `users:deleteMyAccount` is specified, not built |
| No admin MFA recovery codes | **High** | A lost authenticator needs `userMfa` cleared by hand — documented in `RUNBOOKS.md` §4 |
| No uptime monitoring | Medium | Error capture cannot report that the site is entirely down; an external check is unconfigured |
| Legal decisions outstanding | Medium | Controller, jurisdiction, LIA, DPAs — all framed in `DATA_PROTECTION.md` §9, none decided |
| Email required for recovery | Medium | With no email provider there is no reset path and no alerting |
| No cost alerts on Convex/providers | Medium | Budget reservations exist in code; no external ceiling |
| No in-app notification of interest | Medium | The founder sees interest on next visit; nothing pings them |
| `investedAt`/`deployedUsd` hard-coded empty | Medium | Honest, but investor dashboards show permanent zeros until investments are first-class |
| No audit-log browsing UI | Low | `adminAuditLog` is written but only readable in Convex |
| Campaign/outreach/research UI | Low | Backend exists and is tested; not needed for the catalogue loop |

## What is genuinely solid

- **Signup intake fails closed.** Missing `RATE_LIMIT_SECRET` returns 503 rather
  than accepting unmetered writes. The origin allowlist never echoes `*`. IPs
  are HMAC-keyed, never stored raw.
- **Role escalation is impossible from the client.** `admin` is clamped out of
  every sign-up payload; the bootstrap secret self-closes once any admin exists.
- **Admin access requires per-session TOTP step-up**, not merely the admin role,
  so a stolen refresh token is insufficient.
- **Suspension takes effect on the next request**, enforced in the authz helper
  rather than at sign-in.
- **No fabricated data ships.** Empty states are real; fictional records are
  confined to `scripts/seed-dev.mjs`, which refuses non-`dev:` deployments.
- **Deployment fails loudly without a backend** rather than publishing a site
  nobody can sign into.
- **Publication is consensual and reversible.** Nothing about an organization
  becomes public without an explicit founder submission, and withdrawal is
  immediate and unconditional.

## Before opening the doors

1. **Purge the orphaned auth tables** on every deployment (`RUNBOOKS.md` §7).
   This is orphaned credential material and should go first.
2. Configure an email provider. Without one there is no password recovery, no
   address verification, and no alerting.
3. Set `ALERT_EMAIL` so the hourly error check can actually reach someone.
4. Set `ADMIN_BOOTSTRAP_SECRET`, create the operator account, promote it, enrol
   the authenticator, then rotate the secret out.
5. **Run the restore rehearsal** (`RUNBOOKS.md` §2) and fill in the log. The
   backup tooling is proven; the restore is not.
6. Choose an off-vendor backup location and record it.
7. Make the legal decisions in `DATA_PROTECTION.md` §9 — controller identity and
   a monitored privacy contact are the two that block collecting real data.
8. Run a closed pilot — invited founders and investors — and watch the first
   listing go through review end to end before opening sign-ups publicly.

Outbound outreach email stays disabled throughout. It is a separate activation
with its own compliance, suppression and deliverability work, and the catalogue
loop does not need it.

No provider credential should be added merely to make `/system` appear
configured. Each integration is activated only after its failure, privacy, cost
and deletion paths are exercised.
