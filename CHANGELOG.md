# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
from 1.0.0 onward. While the project is pre-1.0, minor versions may contain
breaking changes; see [Launch readiness](docs/LAUNCH_READINESS.md) before
treating any part of the preview as production-ready.

## [Unreleased]

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
