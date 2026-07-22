# Contributing

Thank you for helping capital travel further. Contributions are welcome across engineering, design, documentation, policy, localization, and investor-data quality.

## Workflow

1. Open an issue for material behavior or schema changes.
2. Fork the project and create a focused branch.
3. Install with `bun install`.
4. Add tests for policy, matching, state transitions, or provider parsing changes.
5. Run `bun run check`.
6. Open a pull request describing user impact, data impact, verification, and rollback.

## Pull-request checklist

- [ ] Preview/sample behavior is labeled and cannot be confused with live behavior.
- [ ] New personal data has purpose, retention, deletion, and access-control documentation.
- [ ] New automation has a human-control and failure-state story.
- [ ] Provider calls are bounded, observable, and idempotent where needed.
- [ ] UI is keyboard accessible and responsive at 360px, 768px, 1024px, and wide desktop.
- [ ] No secrets, real contact lists, or founder data are committed.

## Data contributions

Do not submit databases of personal email addresses. Investor-thesis improvements should cite official public sources and avoid unnecessary personal data. Maintainers may remove data contributions that lack provenance or create compliance risk.

## Commit style

Use short imperative subjects such as `Add suppression preflight check`. Keep generated files and unrelated formatting out of focused commits.
