# Roadmap

## v0.1 — Foundation (current)

- Product narrative, founder intake, sample workspace, provider boundaries.
- Transparent deterministic matcher and outbound safety policy.
- Multi-tenant Convex schema, webhook verification, tests, and operating docs.
- Founder/institution control center and consented investor-catalogue preview.
- Live, non-PII homepage signup counter read directly from Convex (never fabricated).
- Real, persisted catalogue interest signals (email + note) instead of local-only UI state.
- Best-effort automated UI translation (`/api/translate`, OpenAI-backed) across the homepage, catalogue, and signup flow.

## v0.2 — Secure private beta

- Authenticated organizations and invitations.
- Durable Exa discovery/normalization workflow with entity deduplication.
- Source evidence viewer and correction workflow.
- Draft review diff, approval expiry, and dual suppression checks.
- Inbound reply threading, campaign budgets, and emergency pause.
- Accessibility and external security review.

## v0.3 — Ecosystem intelligence

- Optional warm-introduction graph with explicit consent.
- Community-maintained investor thesis corrections.
- Institution/grant and development-finance instruments.
- Reviewer-controlled, professionally checked translation for private founder context and outbound drafts (v0.1's translation layer only covers public UI copy).
- Portable campaign export and deletion tooling.

## Non-goals

- Selling or brokering scraped personal data.
- Unattended high-volume cold email.
- Ranking founders by protected attributes or opaque “fundability” scores.
- Guaranteeing funding outcomes.
- Replacing legal, fundraising, or investment advice.
