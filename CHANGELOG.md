# Changelog

## Unreleased

### Added — the two-sided loop

- **Catalogue publication lifecycle.** `catalogueListings` previously had no
  writer anywhere in the codebase: `listPublished` read it and nothing inserted
  into it, so the catalogue was structurally incapable of ever being non-empty.
  Founders now draft, submit and withdraw (`private → review → listed`), and
  operators approve or send back. A founder controls entry and exit
  unconditionally; an operator controls only the middle transition and cannot
  publish a draft that was never submitted. Editing a live listing returns it to
  review, so an approval cannot be reused for different text.
- **Founder workspace at `/dashboard/organization`** — create an organization,
  describe the company, write the public listing, and read who has been in
  touch. Every mutation behind it already existed and was tested; none of it had
  a user interface, so a founder could create an account and then do nothing.
- **Founder interest inbox with accept/decline.** `investorInterests` rows were
  written and never read by anything a founder could see. The investor's email
  address is released to the founder only on accept, and the company website is
  released to the investor only on accept — both pinned by tests.
- **Operator listing review at `/admin/listings`**, behind MFA step-up, with the
  decision and its reason written to the admin audit log.
- **Password reset and email verification**, implemented over the existing
  multi-provider email chain. Both are transactional and deliberately *not*
  gated by `OUTBOUND_EMAIL_ENABLED`: holding a password reset behind the
  outreach kill switch would lock every user out of their own account for as
  long as outreach stayed disabled. Suppression lists are not consulted either.
  New `REQUIRE_EMAIL_VERIFICATION` variable, defaulting to on wherever email is
  configured and ignored where it is not.
- **Profile routes `/dashboard/profile` and `/investor/profile`.** The
  onboarding checklist had always linked to both; neither existed, so the first
  action the product asked a new account to take was a dead link on both sides.
- 20 new tests covering the publication lifecycle, the disclosure gates, tenant
  isolation between founders, and the rule that every onboarding action points
  at a route the app actually builds.

### Added — operations and data protection

- **Error capture and alerting.** Uncaught browser errors, React render errors
  and Convex failures are recorded, grouped by fingerprint, and shown at
  `/admin/errors`. An hourly cron emails `ALERT_EMAIL` when three or more
  distinct problems appear within an hour. Previously a production failure was
  discovered by a user reporting it: a static export has no server log to tail.
- **Redaction before storage** (`lib/redaction.ts`): emails, JWTs, bearer
  tokens, vendor keys, query strings, long digit runs and one-time codes are
  stripped before an error is written. Redacting on read would leave the raw
  value in the database, which is what a subject access request or a breach
  would expose. No user id is stored — only a coarse role.
- **Retention is implemented.** Unsuccessful signups (`new`, `reviewing`,
  `declined`) are deleted 24 months after last contact. `invited` and `active`
  records, and any record claimed by an account, are never swept. Suppressions
  and audit logs never expire — deleting a suppression would silently re-permit
  contacting someone who opted out. Configurable with
  `SIGNUP_RETENTION_MONTHS`.
- **Verifiable backups** (`scripts/backup.mjs`, `bun run backup`): wraps
  `convex export` with a SHA-256, a provenance manifest, refusal to overwrite,
  and a warning on a suspiciously small archive.
- **`docs/RUNBOOKS.md`** — backup, restore rehearsal, error response, MFA
  lockout, deletion requests, retention, orphaned-table purge, rollback.
- **`docs/DATA_PROTECTION.md`** — what is collected, retention, lawful basis,
  processors, and a collected list of open operator decisions. States plainly
  that the controller is whoever runs a deployment, not the project.
- 27 new tests covering redaction, fingerprinting, the capture ceiling, and the
  retention sweep's non-actions.

### Fixed

- **CI's dependency audit was failing on `main`.** The `nanoid` override pinned
  `3.3.17` while advisory GHSA-2v37-7h3g-55p8 is fixed in `3.3.18`, so the
  override — whose stated purpose is forcing transitive dependencies to their
  fixed releases — was pinning a known-vulnerable version.
- `investorInterests.investorOrganizationId` is now optional. Requiring an angel
  to create an organization put a toll gate in front of the single action the
  investor side exists for.
- The participant onboarding signal `hasOrganization` was derived from campaign
  count, conflating "has an organization" with "has run a campaign" and leaving
  the step permanently unticked.
- `EmailMessage.unsubscribeUrl` is optional, so transactional authentication
  mail no longer carries a `List-Unsubscribe` header — semantically wrong for a
  message the recipient requested seconds ago, and a deliverability
  anti-pattern.
- **Circular type inference in `convex/observability.ts`** silently degraded the
  entire generated `api` type to `any`, taking every component's Convex types
  with it. An action that calls mutations in its own module through `internal`
  needs an explicit return type annotation.
- `/system` still described workspace and catalogue records as "fictional
  demonstration data until authenticated multi-tenant accounts are wired up",
  which stopped being true.
- README sections describing the removed `techadmin` and `/status` auth systems
  pointed at scripts, routes and library files that no longer exist. Replaced
  with the Convex Auth flow that is actually shipped.


### Changed — architecture

- **Backend moved entirely into Convex.** All 18 Next.js API routes were deleted.
  Signup, catalogue interest and UI translation are now rate-limited Convex HTTP
  actions; discovery, drafting and delivery are Convex actions; the Resend
  webhook is a Convex HTTP action that finally persists events and writes
  suppressions instead of discarding them.
- **Hosting moved from Vercel to GitHub Pages** as a static export. See
  `docs/SECURITY.md` for the response headers this costs and the compensating
  controls; the trade is documented rather than glossed.
- **Authentication replaced with Convex Auth.** The two bespoke session systems
  (`adminSessions`, `founderSessions`, and their five supporting tables) are
  gone. Accounts now carry a role — participant, investor (eight types), or
  admin — and `admin` can never be self-assigned.
- **Admin access requires per-session TOTP step-up.** Being an admin is no
  longer sufficient: `requireAdmin` demands that the current session proved
  possession of an authenticator within the last eight hours.
- Dropped the `openai`, `resend` and `svix` dependencies in favour of `fetch`
  against the three REST APIs, which keeps every Convex function in the fast V8
  runtime instead of forcing the Node runtime.

### Added

- Dedicated, metrics-led dashboards for participants, investors and operators,
  with a shared Recharts-based chart system: fixed categorical hue order
  validated for colour-vision deficiency against this site's paper surface,
  a table view on every chart, and honest empty states.
- A tested metrics layer (`lib/metrics-core.ts`, `admin-metrics.ts`,
  `participant-metrics.ts`, `investor-metrics.ts`) where a rate with no
  denominator is `null`, never `0`.
- Onboarding checklists and dismissable guidance panels per role, with progress
  derived from real account state where it can be observed.
- `research:verifyCandidate` — the human gate that promotes a discovered
  research candidate into a contactable investor, plus campaign match scoring.

### Removed

- `lib/demo-data.ts` and the six fictional catalogue profiles. The catalogue now
  reads founder-published listings and shows an empty state when there are none;
  discovery without an Exa key reports that it is unconfigured rather than
  returning sample investors. Fictional records moved to `scripts/seed-dev.mjs`,
  which refuses to run against a non-`dev:` deployment.


All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
from 1.0.0 onward. While the project is pre-1.0, minor versions may contain
breaking changes; see [Launch readiness](docs/LAUNCH_READINESS.md) before
treating any part of the preview as production-ready.

## [Unreleased]

### Fixed

- CI: commit `convex/_generated` so typecheck and convex-test no longer fail
  without a Convex deployment; resolve brace-expansion advisories via
  `overrides` instead of audit ignores; bump Actions off Node 20
  (`checkout`/`upload-artifact` v5, `setup-uv` v7, CodeQL v4); remove dead
  in-process signup rate-limit helpers that only produced lint warnings.

### Added

- Content-Security-Policy, `Strict-Transport-Security`, `Cross-Origin-Resource-Policy`,
  and `X-DNS-Prefetch-Control` response headers. `next.config.ts` documents why
  `script-src` retains `'unsafe-inline'` and what removing it would cost.
- Route-level test suites for `POST /api/send`, `POST /api/signups`, and
  `POST /api/admin/login`, covering authorization, request-trust, payload, and
  policy gates — including a test that a fully valid, human-approved message is
  still blocked while the operator flag is off.
- Component test suites for the homepage diagrams, including geometry
  invariants (nodes on the ring, arcs clear of node discs, labels inside the
  viewBox) and a check that every world-map marker matches its city's true
  Mercator projection.
- `regionSharePercent()` in `lib/network-stats.ts`, with unit tests.
- Coverage reporting via `bun run test:coverage`.
- `CHANGELOG.md`, `.github/CODEOWNERS`, and Dependabot configuration.
- CodeQL analysis and a dependency-audit job in CI.

### Changed

- The homepage economics flywheel was rebuilt. Geometry is now generated from
  angles instead of hand-placed pixels, arcs are trimmed clear of the node discs
  so arrowheads are visible, node discs are large enough to contain their own
  numbers, and the diagram gained the broken/closed states the section copy
  already described.
- The homepage world map now places every marker with the projection the map
  actually uses (Mercator, documented in `components/world-signal.tsx`). The UK
  and EU markers no longer overlap, and their routes are bowed apart.
- The `SIGNAL ACTIVE 04` badge, which named no real metric, was replaced with a
  legend explaining the map's symbols.
- The system-bento diagrams now label what each pipeline stage produces.
- All dependencies are pinned to exact versions so a fresh install without the
  lockfile resolves to what CI verified.

### Fixed

- Homepage region bars rendered at their share squared — a 50% region drew at
  25% — because the percentage sized the track element and a `width: inherit`
  pseudo-element then took that same percentage of the track. The track is now
  full width with the fill driven by a custom property.
- Flywheel arcs were stroked in `--acid` on `--paper`, a contrast ratio of about
  1.03:1, which made them effectively invisible.

### Removed

- `@convex-dev/auth`, `animejs`, `clsx`, and `exa-js`, none of which were
  referenced by any code path.

## [0.1.0] - 2026-07-24

Initial public preview.

### Added

- Public site explaining the operating model, principles, and system.
- Three-step `/signup` interest questionnaire with shared validation
  (`lib/domain.ts`), honeypot, same-origin checks, byte-accurate payload limits,
  and durable Convex-backed rate limits.
- Convex persistence for interest signups and catalogue interest signals, with
  email-normalized deduplication.
- Founder workspace and VC catalogue as labeled preview surfaces.
- Techadmin authentication: scrypt password hashing, Convex-backed revocable
  sessions, mandatory RFC 6238 TOTP, and per-address rate limiting.
- Founder status-check login, separate from techadmin.
- Fail-closed outbound email behind operator, approval, source, jurisdiction,
  suppression, postal-identity, and unsubscribe gates.
- Exa discovery, OpenAI drafting, and Resend delivery integration boundaries,
  each degrading to a labeled non-fabricated placeholder without credentials.
- `/plan` and `/pacing` outreach and portfolio math, unit-tested.
- Automated UI translation with a site-wide language switcher.
- Architecture, compliance, deployment, launch-readiness, map-data, roadmap, and
  security documentation.

[Unreleased]: https://github.com/chrisnkuno/firstcontact/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/chrisnkuno/firstcontact/releases/tag/v0.1.0
