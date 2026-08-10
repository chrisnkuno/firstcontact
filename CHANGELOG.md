# Changelog

## Unreleased

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
