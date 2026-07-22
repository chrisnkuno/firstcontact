# Deployment

## Environments

Maintain separate `development`, `staging`, and `production` Convex deployments, provider keys, Resend domains, and webhook secrets. Never use production contact data for local testing.

## 1. Application

```bash
bun install --frozen-lockfile
bun run check
```

Deploy the Next.js app to Vercel or another Node.js 22-compatible host. Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin.

## 2. Convex

```bash
bunx convex dev
bunx convex deploy
```

The first command creates a development project and generates `convex/_generated`. Configure authentication following the current [Convex Auth documentation](https://docs.convex.dev/auth) and enforce membership checks described in the architecture document before storing real data.

## 3. Exa

Create an API key and set `EXA_API_KEY` server-side. The discovery adapter calls `POST https://api.exa.ai/search`, uses content highlights, and stores `requestId`. Review current [Exa Search API documentation](https://exa.ai/docs/reference/search) before changing search modes or categories.

## 4. OpenAI

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-5-nano`). The draft route uses the Responses API and a strict JSON schema. Review current [GPT-5 nano](https://developers.openai.com/api/docs/models/gpt-5-nano) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) documentation when upgrading.

## 5. Resend

1. Verify a dedicated sending subdomain with SPF and DKIM; publish DMARC.
2. Set a sender that accepts replies in `RESEND_FROM`.
3. Configure `RESEND_API_KEY`.
4. Create a webhook pointing to `https://your-origin/api/webhooks/resend` and subscribe to sent, delivered, delayed, bounced, complained, failed, and received events.
5. Set its signing secret as `RESEND_WEBHOOK_SECRET`.
6. Connect the verified route to `internal.webhooks.recordResendEvent` after Convex code generation.

Resend documents webhook event types and signature verification in its [official webhook documentation](https://resend.com/docs/webhooks/event-types).

## 6. Outbound activation

Set `OUTBOUND_API_TOKEN` to a high-entropy secret as a temporary server-to-server boundary. Replace it with identity-derived organization authorization before public production use. Keep `OUTBOUND_EMAIL_ENABLED=false` until all checks in `COMPLIANCE.md` pass in staging. Start production at a low `OUTBOUND_DAILY_LIMIT`, monitor complaints and bounces, and provide a global emergency pause. This flag is only one gate; authorization, message approval, and policy checks remain mandatory.

## Rollback

Application rollback must not roll back suppressions or audit state. Pause campaigns first, roll back stateless application code, verify webhook ingestion, and then resume only after checking queued messages for duplicates.
