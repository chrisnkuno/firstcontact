# Launch readiness

This document separates what is shipped from what requires operator-owned accounts, credentials, legal decisions, or real users. The maintained public preview is [firstcontact-tau.vercel.app](https://firstcontact-tau.vercel.app).

## Shipped and verified

- Responsive Swiss-style public experience, organization intake preview, founder control center, and VC catalogue.
- Separate private, outreach-approved, and catalogue-approved data boundaries in the product and schema.
- Human approval, source, jurisdiction, suppression, sender identity, unsubscribe, authorization, and idempotency gates around delivery.
- Exa discovery, GPT-5 nano structured drafting, Resend delivery/webhook, and Convex storage integration boundaries.
- Privacy, terms, security, responsible-outreach, architecture, deployment, contribution, and roadmap documentation.
- Sitemap, robots policy, manifest, social image, custom 404, self-hosted fonts, keyboard focus, reduced-motion behavior, and HTTP security headers.
- GitHub CI and Vercel production build passing.

## External activation required

| Capability | Current public preview | Required before real use |
|---|---|---|
| Accounts and tenancy | No sign-in; fictional organizations | Configure Convex Auth, identity-derived membership checks, invitations, recovery, and account deletion |
| Persistence | UI state only | Create separate development/staging/production Convex deployments and generate functions |
| Catalogue | Fictional founder-approved examples | Listing review workflow, authenticated investors, organization consent, corrections, delisting, and interest notification |
| Discovery | Sample match data | Exa key, durable normalization workflow, entity deduplication, source re-verification, budget limits |
| Drafting | Non-fabricated placeholder/sample drafts | OpenAI key, prompt/version logging, evaluation set, claim review, token budgets |
| Email | Disabled and unauthorized by default | Resend verified reply-capable domain, SPF/DKIM/DMARC, signed webhook persistence, tested bounce/complaint/unsubscribe handling |
| Legal operations | Engineering controls and templates | Named controller/operator, monitored privacy contact, jurisdiction matrix, LIA/consent records, DPA/SCC review, retention decisions |
| Production operations | Health endpoint and Vercel logs | Alerts, error tracking with redaction, backup/restore exercise, deletion runbook, incident ownership, cost alerts |
| Automatic deployment | Manual Vercel CLI deployment works | Connect GitHub as a Vercel account login connection, then attach `chrisnkuno/firstcontact` to the Vercel project |

## Recommended activation order

1. Configure authentication and tenant authorization; prove cross-tenant isolation.
2. Configure Convex and persist profiles, field-level visibility, campaigns, approvals, interests, suppressions, and audit history.
3. Run a closed catalogue pilot with verified organizations and invited investors; do not enable email.
4. Add Exa and OpenAI with hard per-tenant budgets and reviewed evaluation fixtures.
5. Complete legal/deliverability review, configure Resend, and test the entire event and suppression path in staging.
6. Enable production delivery at a very low cap with a tested global pause.

No provider credential should be added merely to make the health endpoint appear “configured.” Each integration should be activated only after its failure, privacy, cost, and deletion paths are exercised.
