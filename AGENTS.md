# Repository guidance for coding agents

- Preserve the distinction between preview data and live persisted/provider data.
- Never add auto-send behavior that bypasses approval, suppression, jurisdiction, source, or operator gates.
- Keep provider secrets server-side; never expose them through `NEXT_PUBLIC_*`.
- Use `lib/domain.ts` as the shared validation contract and add tests for policy changes.
- Convex is the production source of truth; external providers are replaceable adapters.
- Do not invent investor contacts, firm mandates, founder traction, or production verification.
- Before handoff run typecheck, tests, lint, build, and `git diff --check` where Git metadata is available.
