# Launch readiness

This document separates what is shipped from what requires operator-owned accounts, credentials, legal decisions, or real users. The maintained public preview is [firstcontact-tau.vercel.app](https://firstcontact-tau.vercel.app).

## Shipped and verified

- Responsive Swiss-style public experience, organization intake preview, founder control center, and VC catalogue.
- Separate private, outreach-approved, and catalogue-approved data boundaries in the product and schema.
- Human approval, source, jurisdiction, suppression, sender identity, unsubscribe, authorization, and idempotency gates around delivery.
- Exa discovery, GPT-5 nano structured drafting, Resend delivery/webhook, and Convex storage integration boundaries.
- FastAPI API/dispatcher foundation with OIDC-aware user routes, Convex workflow leases, provider budget reservations, scoped Exa gateway, source persistence, bounded retries, and orphan-sandbox reconciliation.
- Privacy, terms, security, responsible-outreach, architecture, deployment, contribution, and roadmap documentation.
- Sitemap, robots policy, manifest, social image, custom 404, self-hosted fonts, keyboard focus, reduced-motion behavior, and HTTP security headers.
- GitHub CI and Vercel production build passing.

## External activation required

| Capability | Current public preview | Required before real use |
|---|---|---|
| Accounts and tenancy | No sign-in; fictional organizations | Configure Convex Auth, identity-derived membership checks, invitations, recovery, and account deletion |
| Persistence | UI state only | Create separate development/staging/production Convex deployments and generate functions |
| Catalogue | Fictional founder-approved examples; investor "Express interest" now writes a real, deduplicated `catalogueInterestSignals` record in Convex | Listing review workflow, authenticated investors, organization consent, corrections, delisting, and interest notification to the organization |
| Discovery | Sample match data | Exa key, durable normalization workflow, entity deduplication, source re-verification, budget limits |
| Drafting | Non-fabricated placeholder/sample drafts | OpenAI key, prompt/version logging, evaluation set, claim review, token budgets |
| Email | Disabled and unauthorized by default | Resend verified reply-capable domain, SPF/DKIM/DMARC, signed webhook persistence, tested bounce/complaint/unsubscribe handling |
| Legal operations | Engineering controls and templates | Named controller/operator, monitored privacy contact, jurisdiction matrix, LIA/consent records, DPA/SCC review, retention decisions |
| Production operations | Health endpoint and Vercel logs | Alerts, error tracking with redaction, backup/restore exercise, deletion runbook, incident ownership, cost alerts |
| FastAPI + E2B workflow | OIDC/tenant-aware control-plane code and scoped, budgeted Exa discovery path are implemented locally | Choose/configure the browser OIDC provider, deploy a reviewed E2B template plus API/dispatcher, run live staging integration tests, add verified normalization, alerts, and workspace integration |
| Automatic deployment | Manual Vercel CLI deployment works | Connect GitHub as a Vercel account login connection, then attach `chrisnkuno/firstcontact` to the Vercel project |

## Math tools and techadmin auth — what's real, what's illustrative, what's missing

Added in the same pass: `/plan` and `/pacing` (outreach/pacing math), the homepage economics diagram, and the `/admin` techadmin system. Same rule as everywhere else in this document: nothing here should be read as more finished than it is.

| Area | Real | Illustrative / not yet built |
|---|---|---|
| `/plan`, `/pacing` math | The funnel arithmetic itself (`lib/outreach-math.ts`, `lib/portfolio-math.ts`) is exact and unit-tested | The default conversion rates and check sizes are general planning assumptions, not FirstContact's own measured performance — every input is user-editable for exactly that reason |
| `/plan`, `/pacing` scorecards | Pulled live from Convex (`/api/stats`, `/api/catalogue-stats`); shows nothing rather than a fabricated number when unconfigured | No personalized/per-user tracking — that needs the founder/investor account system below, which doesn't exist yet |
| Homepage economics diagram | — | Fully illustrative: a general capital-formation/multiplier/agglomeration explanation, not a claim about this specific network's outcomes |
| Techadmin login | Real scrypt password hashing, Convex-backed revocable sessions, HttpOnly/Secure/SameSite=Strict cookies, per-address and per-address+email rate limits, generic error messages (no user enumeration), same-origin request checks | No password-reset flow — re-run `scripts/create-admin.mjs` with the same email to reset |
| Techadmin MFA | Real, self-contained RFC 6238 TOTP (`lib/totp.ts`), mandatory after first login, single-use challenge cookies, works with any standard authenticator app | No backup/recovery codes — a lost authenticator device currently requires an operator to clear `mfaSecret`/`mfaEnabled` by hand in the Convex dashboard |
| Techadmin roles | — | One role only (`techadmin`); no per-admin permission levels, no invitation flow, no way to list/revoke other admins' sessions from the UI |
| Techadmin audit trail | Status changes are written to `adminAuditLog` | No UI to browse it yet — read it directly in the Convex dashboard |
| Techadmin vs. founder/investor auth | — | This is a narrow, single-role system built with self-contained primitives (scrypt, hand-rolled TOTP) matching this repo's existing secret-gated-mutation pattern. It is **not** the `@convex-dev/auth` multi-tenant integration this document's "Accounts and tenancy" row calls for — that remains separate, unbuilt work for founder/investor accounts |

## Recommended activation order

1. Configure authentication and tenant authorization; prove cross-tenant isolation.
2. Configure Convex and persist profiles, field-level visibility, campaigns, approvals, interests, suppressions, and audit history.
3. Run a closed catalogue pilot with verified organizations and invited investors; do not enable email.
4. Add Exa and OpenAI with hard per-tenant budgets and reviewed evaluation fixtures.
5. Complete legal/deliverability review, configure Resend, and test the entire event and suppression path in staging.
6. Enable production delivery at a very low cap with a tested global pause.

No provider credential should be added merely to make the health endpoint appear “configured.” Each integration should be activated only after its failure, privacy, cost, and deletion paths are exercised.
