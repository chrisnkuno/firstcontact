# Operational runbooks

Procedures for the things that go wrong. Each one is written to be followed by
someone who is tired, under pressure, and not the person who wrote the code.

Every runbook here states what it *cannot* do as clearly as what it can. A
runbook that overstates its coverage is worse than none, because it stops the
reader looking for the real answer.

---

## 1. Backup

### Taking one

```bash
node --env-file=.env.local scripts/backup.mjs           # current deployment
node scripts/backup.mjs --prod --out ./backups          # production
```

The script wraps `convex export` and additionally writes a `.json` manifest
recording the deployment, timestamp, byte size and SHA-256. It refuses to
overwrite an existing archive, and warns loudly if the archive is under 1 KB —
the classic silent failure is a nightly job that "succeeds" against an empty or
misconfigured deployment and restores nothing.

### Verifying one

```bash
shasum -a 256 backups/convex-prod-<stamp>.zip
```

Compare against `sha256` in the sibling manifest. **Do this on a machine that
did not create the backup**, or you are only verifying that the file has not
changed since you wrote it.

### Where backups live

Convex retains its own snapshots on paid plans, but that is a vendor-managed
copy of vendor-managed data — it does not survive account loss, billing
failure, or an accidental deletion of the deployment itself. Keep at least one
copy somewhere you control.

> **Open decision.** This project does not prescribe a storage location; the
> operator must choose one, and record it here. Until that line is filled in,
> assume there is no off-vendor copy.
>
> Off-vendor backup location: `[OPERATOR: not yet decided]`
> Retention of backups: `[OPERATOR: not yet decided]`

---

## 2. Restore rehearsal

**Status: never executed.** This procedure is written but unproven. Until
someone runs it end to end and records the result below, treat the ability to
restore as an assumption rather than a fact.

A restore is destructive and irreversible. It is therefore never rehearsed
against production. The rehearsal restores into a *separate* deployment and
compares.

### Procedure

1. **Take a fresh backup** of production and verify its checksum (§1).

2. **Create a scratch deployment.** In the Convex dashboard, create a new
   project — for example `firstcontact-restore-drill`. Do not reuse dev or
   staging: the drill will overwrite everything in the target.

3. **Import into the scratch deployment.**

   ```bash
   CONVEX_DEPLOYMENT=<scratch-deployment> \
     bunx convex import --replace backups/convex-prod-<stamp>.zip
   ```

   `--replace` is what makes this a restore rather than a merge. Confirm the
   deployment name in the prompt before accepting; this is the step where a
   mistyped target destroys the wrong database.

4. **Verify the data, not just the exit code.** Against the scratch deployment,
   confirm each of these — a restore that returns zero and loses a table is the
   failure mode worth rehearsing for:

   | Check | Expectation |
   |---|---|
   | `users` row count | matches production within the drift since the backup |
   | `interestSignups` row count | matches |
   | `catalogueListings` with `visibility: "listed"` | matches the live catalogue |
   | `suppressions` row count | **matches exactly** — see the warning below |
   | `adminAuditLog` row count | matches |
   | `userMfa` rows | present, and `enabled` where expected |

5. **Verify the application runs against it.** Point a local build at the
   scratch deployment and sign in:

   ```bash
   NEXT_PUBLIC_CONVEX_URL=<scratch-url> bun run dev
   ```

   Confirm sign-in works, a dashboard loads, and the catalogue renders. A
   database that restored but cannot authenticate anyone is not a working
   restore.

6. **Delete the scratch deployment.** It now contains a full copy of production
   personal data. Leaving it alive creates a second, unmonitored copy of every
   record — which is itself a reportable exposure in most regimes.

7. **Record the result** in the log below.

> ⚠️ **Suppressions are the row type that must never be lost.** A restore that
> drops or partially loads `suppressions` silently re-permits contacting people
> who asked not to be contacted. If the counts do not match exactly, stop and
> treat it as a failed restore.

### Rehearsal log

| Date | Backup used | Performed by | Result | Time to restore | Notes |
|---|---|---|---|---|---|
| — | — | — | **Never rehearsed** | — | Fill this in before launch |

---

## 3. Errors and alerting

### How you find out

- **Alert email** to `ALERT_EMAIL`, sent when three or more *distinct* problems
  appear within an hour, at most once per hour.
- **`/admin/errors`**, which lists redacted problems grouped by fingerprint,
  newest first, with occurrence counts.

Nothing pages anyone out of hours. That is a deliberate limit of the current
setup, not an oversight: this project has no on-call rota to page.

### When an alert arrives

1. Open `/admin/errors`. Sort mentally by `count` — a problem seen 400 times is
   an outage; one seen twice is a bug report.
2. Read the `route` and `source`. `client` means a browser; `convex` means a
   backend function.
3. Check whether it is new or a reopened problem (a resolved error that recurs
   automatically reopens).
4. Fix, deploy, then mark resolved. Marking resolved without fixing is
   self-deception — the next occurrence reopens it anyway.

### If the alert itself fails

A failed alert delivery is recorded as an error with route `/cron/alerts`. This
is the one failure the alerting system cannot tell you about by email, so check
`/admin/errors` for it after any provider change.

### Limits

- No latency, uptime or saturation monitoring — errors only.
- No alert if the site is *entirely* down, because nothing would be running to
  report it. An external uptime check remains unconfigured.

> Uptime monitoring: `[OPERATOR: not yet configured]`

---

## 4. Operator locked out of MFA

An admin who loses their authenticator cannot complete step-up, and every
privileged read and write is refused. There is no backup-code flow.

**Recovery requires Convex dashboard access:**

1. Open the Convex dashboard → Data → `userMfa`.
2. Find the row whose `userId` matches the locked-out admin.
3. Delete the row.
4. The admin signs in and is routed to `/admin/mfa` to enrol again.

Deleting the row is safe: enrolment is mandatory, so an admin with no `userMfa`
row is refused everything privileged until they re-enrol.

> ⚠️ Whoever holds Convex dashboard access can therefore bypass MFA for any
> admin. Dashboard access is the real root of trust here, and should be
> protected accordingly — with its own MFA, and shared with as few people as
> possible.

---

## 5. Deletion request from a data subject

Someone asks for their data to be deleted.

1. **Identify the records.** An email address may appear in:
   - `interestSignups` (by `email`)
   - `users` (by `email`), plus `userMfa`, `onboardingState`, `authAccounts`,
     `authSessions` for that user
   - `memberships`, and anything owned by an organization they are sole owner of
   - `investorInterests` (by `investorUserId`)
   - `catalogueInterestSignals` (by `email`)
   - `suppressions` (by **hash** — see below)

2. **Withdraw anything published first.** If they own a `catalogueListings` row
   with `visibility: "listed"`, set it to `private` before deleting anything, so
   the public catalogue never references a deleted record.

3. **Delete.** Currently a manual operation in the Convex dashboard. There is no
   self-service account-deletion flow and no scripted erasure.

   > **Gap.** This is the weakest runbook here. A GDPR-style erasure request has
   > a statutory deadline, and a manual dashboard procedure is slow and
   > error-prone. Building `users:deleteMyAccount` is tracked in
   > `docs/LAUNCH_READINESS.md`.

4. **Do not delete their suppression.** `suppressions` stores an HMAC of the
   address, not the address, and exists precisely so the person is never
   contacted again. Deleting it would re-permit contact — the opposite of what
   they asked for. Retaining it is generally defensible as a legal obligation to
   honour an opt-out; record the reasoning if challenged.

5. **Record the action** in the audit log with the date and what was removed —
   without restating the personal data being erased.

---

## 6. Automatic retention

Runs daily at 03:15 UTC (`convex/crons.ts`).

| Data | Policy |
|---|---|
| `interestSignups` with status `new`, `reviewing`, `declined` | Deleted 24 months after **last contact** (`updatedAt`), unless claimed by an account |
| `interestSignups` with status `invited`, `active` | Never auto-deleted — an ongoing relationship |
| Resolved `errorEvents` | Deleted 90 days after last occurrence |
| `rateLimits`, `sessionMfaVerifications` | Deleted on expiry |
| `suppressions`, `adminAuditLog`, `auditEvents`, `webhookEvents` | **Never** auto-deleted |

Override the signup period with `SIGNUP_RETENTION_MONTHS` on the Convex
deployment. It is a legal decision rather than a technical constant, so a fork
under a different regime will set it differently.

Only counts are recorded (`operationalState`), never which records were deleted
— logging that would recreate the personal data the sweep just removed, in a
table that is never swept.

---

## 7. Purging orphaned tables from the removed auth systems

**Applies to any deployment that existed before the Convex Auth migration.**

The migration removed `adminUsers`, `adminSessions`, `adminLoginAttempts`,
`adminMfaChallenges`, `founderAccounts`, `founderSessions`,
`founderLoginAttempts` and `signupRateLimits` from `convex/schema.ts`. Removing
a table from the schema does **not** delete it: the rows remain in the
deployment, unreachable from application code but fully present in the database
and in every snapshot export.

This was confirmed on the development deployment on 2026-08-20, which still held
one `adminUsers` row carrying `email`, `passwordHash` and `mfaSecret`.

Why this matters:

- It is orphaned **credential material** — a password hash and a live TOTP
  secret for an operator account — retained with no purpose and no expiry.
- Nothing sweeps it. The retention job only touches tables in the schema.
- It is copied into every backup, so it propagates to any restore target.
- Under §5 of `docs/DATA_PROTECTION.md` it is personal data held without a
  lawful basis, since the purpose it was collected for no longer exists.

### Procedure

There is no scripted fix, because a Convex mutation cannot address a table the
schema does not declare.

1. Take a backup first (§1). This is deletion of the only remaining copy.
2. Convex dashboard → Data.
3. For each orphaned table listed above, confirm the row count is what you
   expect, then **Delete table**.
4. Re-run `node scripts/backup.mjs` and confirm the tables no longer appear:

   ```bash
   unzip -l backups/<archive>.zip | grep -E 'adminUsers|founderAccounts'
   ```

   No output means the purge worked.
5. Repeat for every deployment — dev, staging and production are separate
   databases and each keeps its own orphans.

Do this before the first restore rehearsal, so the rehearsal does not create yet
another copy.

---

## 8. Rolling back a bad deploy

The site is a static export on GitHub Pages; Convex functions deploy separately.

- **Frontend:** re-run the Pages workflow from the last good commit.
- **Convex functions:** `bunx convex deploy` from the last good commit.
- **Schema:** rolling *back* a schema change that already dropped a field does
  not restore the data. Restore from backup (§2) — which is why §2 being
  unrehearsed matters.

Application rollback must never roll back audit state. `legacyAdminAuditLog`
exists for exactly this reason.
