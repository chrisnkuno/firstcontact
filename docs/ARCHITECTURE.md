# Architecture

## Design goals

FirstContact is designed around five invariants:

1. **Evidence is durable.** Investor claims keep their public URL, capture time, and provider request ID.
2. **Automation is bounded.** A model may rank or draft, but may not authorize a send or invent a factual claim.
3. **Side effects are idempotent.** Every message and webhook has a stable idempotency key.
4. **Multi-tenancy is explicit.** Every founder-owned record resolves through an organization membership.
5. **Failure is visible.** Missing provider configuration produces preview or blocked states, never synthetic success.
6. **Visibility is field-specific.** Private intake, outreach-approved claims, and catalogue-approved fields are separate data boundaries.

## Components

### Next.js application

The App Router serves public pages, authenticated workspace surfaces, health reporting, and externally reachable webhooks. Current API routes demonstrate provider boundaries. In a production deployment, user-initiated mutations should write intent to Convex and schedule actions rather than invoke side effects directly from a browser.

### Convex source of truth

`convex/schema.ts` models tenant state and operational history. Mutations enforce state transitions; actions call external providers; scheduled workflows handle retries and rate limits. Convex recommends recording intent in a mutation and scheduling network side effects, because actions themselves cannot be automatically retried safely.

### Two-sided product boundary

Organizations own profiles, campaigns, and catalogue listings. A listing is private until its specific public context, strengths, considerations, traction, and capital need are approved. Investor interest creates an `investorInterests` record; it does not reveal private founder contact data. The organization accepts or declines before any introduction is shared.

“Weaknesses” are represented as founder-approved **open questions or considerations**, never model-generated negative judgments. This keeps diligence useful without creating an opaque reputation score.

Recommended workflow steps:

```text
campaign.created
  └─ discovery.requested
      └─ discovery.completed
          └─ normalization.completed
              └─ matching.completed
                  └─ drafts.created
                      └─ human approval
                          └─ delivery.queued
                              └─ delivery event / reply / suppression
```

Each step accepts an idempotency key and writes its result before scheduling the next step.

### Exa discovery

Use the Search endpoint with the `company` or `people` category, a bounded result count, content highlights, and moderation. Do not treat search results as verified contacts. Normalize canonical domains, deduplicate firms, capture evidence, and flag ambiguous entity/contact types for review. Avoid deprecated Exa `context` and crawl-date fields.

### OpenAI transformation

GPT-5 nano is appropriate for high-volume classification, extraction, matching explanations, and short outreach drafts. Every call should:

- use Structured Outputs;
- pass only the minimum founder and investor context;
- prohibit invented metrics or relationships in the system instruction;
- record model and prompt version;
- return `claimsToVerify` for reviewer attention;
- avoid placing secrets or unnecessary personal data in prompts.

Deterministic scoring in `lib/matching.ts` remains inspectable. A model can supplement it but should not erase source-based reasons or risks.

### Resend delivery

Resend is transport, not campaign state. Store the local message before sending, pass a stable idempotency key, verify webhook signatures over the raw body, store `svix-id` once, and translate delivery/bounce/complaint events into local state. A complaint or hard bounce must create a suppression before any further scheduling.

## Data lifecycle

| Data | Purpose | Default retention proposal | Deletion behavior |
|---|---|---:|---|
| Founder profile | Matching and approved outreach | Active account + 30 days | Delete or de-identify on account request |
| Public source excerpts | Match evidence | 180 days, then re-verify | Remove on source deletion or objection review |
| Contact data | Approved B2B outreach | 180 days since verification | Delete unless suppression is needed |
| Suppression hash | Prevent future contact | Indefinite minimum record | Retain hashed address and reason |
| Drafts/messages | Audit and founder workflow | Deployment-defined | Redact body; retain minimal event metadata |
| Webhook payload | Delivery processing | 30–90 days | Reduce to normalized event fields |

These are defaults to assess, not universal legal conclusions.

## Authorization

Every query and mutation must derive the current identity server-side, load its membership, and verify the requested organization ID. Never accept an actor ID from a browser in production—the sample mutation argument exists only until the auth adapter is wired. Actions receive internal IDs after an authorized mutation records intent.

## Observability

Use structured events with `organizationId`, `campaignId`, `provider`, `requestId`, `step`, `attempt`, and `durationMs`. Never log prompt bodies, email bodies, raw API keys, or unredacted contact details. Track cost and usage per campaign so community deployments can set hard budgets.
