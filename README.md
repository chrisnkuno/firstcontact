# FirstContact

**Open infrastructure for capital access beyond capital-dense ecosystems.**

[![CI](https://github.com/chrisnkuno/firstcontact/actions/workflows/ci.yml/badge.svg)](https://github.com/chrisnkuno/firstcontact/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-173d2d.svg)](LICENSE)
[![Responsible outreach](https://img.shields.io/badge/outreach-human--approved-c8fa52.svg)](docs/COMPLIANCE.md)

FirstContact helps startups and institutions describe their work in context, discover relevant investors across the US, UK, EU, and APAC, build evidence-backed match lists, draft tailored introductions, and operate a transparent fundraising pipeline.

It is deliberately **not** an autonomous cold-email bot. Research and drafting can be automated; contact selection and sending are controlled by source, consent, jurisdiction, suppression, rate-limit, and human-approval gates.

## What is implemented

- A responsive public site explaining the model and principles.
- Founder intake with explicit processing consent and a no-transmission preview mode.
- An operational workspace showing matches, fit evidence, risks, drafts, and event history.
- Exa-powered live discovery with a clearly labeled sample fallback.
- GPT-5 nano structured drafting constrained to supplied facts.
- Resend delivery with one-click unsubscribe headers and fail-closed policy checks.
- Svix signature verification for Resend events.
- A multi-tenant Convex schema for organizations, profiles, sources, investors, campaigns, messages, suppressions, webhooks, and audit events.
- Pure, tested policy and matching modules.

## System boundary

| Capability | Preview without keys | Configured deployment |
|---|---|---|
| Public site and workspace | Fully available | Fully available |
| Founder intake | Browser-only confirmation | Persist through Convex after auth wiring |
| Investor discovery | Labeled sample matches | Live Exa results with request IDs |
| Introduction drafting | Non-fabricated placeholder | Structured GPT-5 nano output |
| Email sending | Blocked | Still blocked until `OUTBOUND_EMAIL_ENABLED=true`, approval, and every policy gate passes |
| Event tracking | Sample history | Signed Resend webhook events; persistence hook documented |

The repository never pretends sample state is production state. `/api/health` reports provider configuration and preview/configured mode.

## Quick start

Prerequisites: Bun 1.3+ and Node.js 22+.

```bash
git clone https://github.com/chrisnkuno/firstcontact.git
cd firstcontact
bun install
cp .env.example .env.local
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The app works in preview mode without provider credentials.

Run the complete local gate:

```bash
bun run check
```

## Configure the live stack

1. Create a Convex deployment with `bunx convex dev`; this generates `convex/_generated` and writes the public deployment URL.
2. Add server-side Exa and OpenAI API keys to the Convex deployment or the Next.js runtime running provider actions.
3. Verify a Resend sending domain, use a reply-capable sender, and configure a signed webhook at `/api/webhooks/resend`.
4. Add authentication and map the identity subject to `memberships.userId` before accepting real founder data.
5. Complete the deployment-specific Legitimate Interests Assessment and region matrix in [Responsible outreach](docs/COMPLIANCE.md).
6. Set a high-entropy `OUTBOUND_API_TOKEN` for the temporary server boundary, then keep `OUTBOUND_EMAIL_ENABLED=false` through staging. Turn it on only after authentication, unsubscribe, bounce, complaint, rate-limit, and audit-event tests pass.

See [Deployment](docs/DEPLOYMENT.md) for the complete sequence.

## Architecture at a glance

```text
Founder → profile + consent → Convex source of truth
                              ↓
                    Exa discovery action
                              ↓
                   normalized sources/investors
                              ↓
                transparent score + GPT draft
                              ↓
            human review → policy gate → Resend
                                            ↓
                             signed events → audit log
```

Provider integrations stay behind narrow boundaries. Exa is discovery, OpenAI is transformation/drafting, Convex is durable state and scheduling, and Resend is transport. None is the source of truth for another provider’s responsibility.

## Documentation

- [Architecture and data flow](docs/ARCHITECTURE.md)
- [Responsible outreach and privacy](docs/COMPLIANCE.md)
- [Security and threat model](docs/SECURITY.md)
- [Deployment and provider setup](docs/DEPLOYMENT.md)
- [Product roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## Current limitations

- Authentication UI and identity-provider configuration are deployment-specific and not silently stubbed.
- Exa results are returned by the route but production normalization should run as a durable Convex workflow.
- The Resend route verifies signatures but its persistence call is left as an explicit integration seam until Convex code generation is run.
- This repository provides engineering controls and operational guidance, not legal advice.

## License

MIT License. See [LICENSE](LICENSE).
