## Outcome

Describe the user-visible or operational outcome.

## Data and automation impact

- New personal data or retention behavior: none / explain
- New provider calls or side effects: none / explain
- Human-control or suppression changes: none / explain

## Verification

- [ ] `bun run check`
- [ ] `bun run api:check` when FastAPI or workflow code changed
- [ ] Preview and configured behavior remain clearly separated
- [ ] Responsive behavior checked where UI changed
- [ ] No secrets or real founder/contact data included

## Rollback

Describe how this can be reverted without losing suppressions or audit state.
