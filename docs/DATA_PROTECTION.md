# Data protection

What personal data this platform holds, who is accountable for it, how long it
is kept, and which decisions are still open.

This document distinguishes three things that are easy to blur, and the
distinction is the point:

- **Decided** — settled, and implemented in code.
- **Structural** — true of the software itself, and true for every deployment.
- **Open** — a decision only the operator of a specific deployment can make.
  Marked `[OPERATOR]`. Nothing here invents an answer to look complete.

---

## 1. Who is the controller

**Structural: FirstContact the open-source project is not a data controller,
and cannot be one.** It processes nothing. It has no deployment, no database,
and no relationship with any data subject.

**The controller is whoever runs a given deployment.** If you clone this
repository, point it at your own Convex deployment, and invite founders and
investors to sign up, then you — personally or through your legal entity — are
the controller of every record in it. You decide the purposes and means of
processing, which is precisely what makes you accountable, regardless of the
fact that you did not write the code.

This is stated plainly because it is the single most commonly misunderstood
point about self-hosting an open-source application. Forking does not transfer
accountability to the project, and the MIT licence's warranty disclaimer does
not shield a deployer from data protection obligations.

### What every deployer must do before collecting real data

1. **Name yourself.** Put a real controller identity — an individual's name or a
   registered entity with its number and address — in your privacy policy. "The
   FirstContact team" is not a controller identity.
2. **Publish a monitored contact.** An address that reaches a human, for
   erasure and access requests. An unmonitored inbox is a compliance failure
   that only surfaces when someone complains to a regulator.
3. **Choose a jurisdiction** and write your policy against it (§2).
4. **Record your lawful basis** for each processing activity (§4).

### This deployment

| Field | Value |
|---|---|
| Controller | `[OPERATOR: not yet named]` |
| Registered address | `[OPERATOR: not yet named]` |
| Privacy contact | `[OPERATOR: not yet named]` |
| Data protection officer | `[OPERATOR: assess whether one is required]` |
| Supervisory authority | `[OPERATOR: follows from §2]` |

The reference deployment at `chrisnkuno.github.io/firstcontact` has **not** made
these decisions. Until it does, it should not collect data from real people
beyond the signup interest form, and should say so.

---

## 2. Jurisdiction

**Open.** Not yet decided for this deployment. The three plausible frames differ
enough that the choice changes the product, not just the paperwork.

| | EU/UK GDPR | Rwanda (Law 058/2021) | US (federal + state) |
|---|---|---|---|
| Lawful basis needed | Yes, per activity | Yes, per activity | Not generally |
| Outreach to business contacts | Legitimate interest, with an LIA | Consent-leaning | CAN-SPAM: opt-out, not opt-in |
| Erasure right | Yes, ~1 month | Yes | CCPA/CPRA in California; patchy elsewhere |
| Cross-border transfers | SCCs or adequacy | Registration/authorisation | Largely unrestricted |
| Registration | No | **Yes — with the NCSA** | No |
| Breach notification | 72 hours | 48 hours | State-by-state |

**Recommendation, unchanged from the assessment:** write to **EU/UK GDPR** as
the baseline. It is the strictest of the three on most axes, so a deployment
that satisfies it generally satisfies the others, and it avoids re-doing the
work if a single EU-resident founder or investor signs up — which, for a
platform explicitly targeting cross-border capital, is a matter of time rather
than probability.

Rwanda's law additionally requires **registration with the National Cyber
Security Authority** before processing, which is a concrete blocking step, not a
formality, if the deployment operates there.

> Chosen jurisdiction: `[OPERATOR: not yet decided]`

---

## 3. What is collected

### Directly from people

| Data | Where | Why |
|---|---|---|
| Name, email, location, organization | `interestSignups`, `users` | Identity and contact |
| Role and investor/participant type | `users` | Which product surface applies |
| Company profile: website, stage, sectors, raise amount, traction, impact, founder context | `startupProfiles` | Matching and listing |
| Published listing text | `catalogueListings` | Shown publicly, only after the founder submits and an operator approves |
| Interest signals and notes | `investorInterests`, `catalogueInterestSignals` | The core two-sided interaction |
| Password | `authAccounts` | Authentication — scrypt-hashed, never recoverable |
| TOTP secret | `userMfa` | Operator second factor |

### Derived or automatic

| Data | Where | Notes |
|---|---|---|
| HMAC of IP address | `rateLimits` | **Raw IPs are never stored.** Keyed with `RATE_LIMIT_SECRET` |
| HMAC of email | `suppressions` | So an opt-out can be honoured without retaining the address |
| Redacted error diagnostics | `errorEvents` | Scrubbed by `lib/redaction.ts` *before* storage; no user id, only a coarse role |
| Audit entries | `adminAuditLog`, `auditEvents` | Who did what, when |

### Orphaned, and awaiting deletion

Tables removed from the schema during the Convex Auth migration still hold rows
in existing deployments — removing a table from `convex/schema.ts` makes it
unreachable from code but does not delete it. Confirmed present on the
development deployment on 2026-08-20:

| Table | Contains |
|---|---|
| `adminUsers` | `email`, `passwordHash`, `mfaSecret` — orphaned credential material |
| `adminSessions`, `adminLoginAttempts`, `adminMfaChallenges` | Superseded operator session data |
| `founderAccounts`, `founderSessions`, `founderLoginAttempts` | Superseded participant session data |
| `signupRateLimits` | Superseded limiter rows |

This is personal data retained with no lawful basis, since the purpose it was
collected for no longer exists. The retention sweep does not reach it — the job
can only address tables the schema declares. **Purge procedure:
`docs/RUNBOOKS.md` §7.** Do it on every deployment before launch.

### Deliberately not collected

- No analytics, no tracking pixels, no third-party scripts. The CSP in
  `app/layout.tsx` would block them.
- No cookies beyond what Convex Auth requires for a session.
- No raw IP addresses, anywhere.
- No user identifier in error reports.

---

## 4. Lawful basis

**Open**, and dependent on §2. The mapping below is the intended one under a
GDPR frame; it must be confirmed, not assumed.

| Activity | Intended basis | Note |
|---|---|---|
| Signup interest form | Consent | Explicit, timestamped in `consentRecordedAt` |
| Account creation and authentication | Contract | Necessary to provide the service |
| Publishing a catalogue listing | Consent | Separate and explicit; withdrawable instantly |
| Expressing investor interest | Contract / legitimate interest | The purpose the investor signed up for |
| Security, rate limiting, audit | Legitimate interest | Balanced against minimal, hashed retention |
| Error diagnostics | Legitimate interest | Redacted before storage |
| **Outreach email** | Legitimate interest, requiring an **LIA** | **Not yet written.** Outbound stays disabled until it is |

> Legitimate Interests Assessment for outreach: `[OPERATOR: not written]`

---

## 5. Retention

**Decided, and implemented** in `convex/maintenance.ts`, swept daily at 03:15
UTC.

| Data | Retention | Rationale |
|---|---|---|
| Unsuccessful signups (`new`, `reviewing`, `declined`) | **24 months after last contact** | A fundraising cycle is slow; a founder may reasonably re-engage a year later. Measured from `updatedAt`, so a conversation resets the clock |
| Signups that became relationships (`invited`, `active`) | Retained | An ongoing relationship, not an unsuccessful enquiry |
| Signups claimed by an account | Retained while the account exists | Deleting would strand a live account |
| Resolved error diagnostics | 90 days | Diagnostics, not records |
| Rate-limit and MFA step-up rows | On expiry | Ephemeral by design |
| Suppressions | **Indefinite** | Deleting one re-permits contacting someone who opted out |
| Audit logs | **Indefinite** | Accountability outlives the records it describes |

Configurable per deployment with `SIGNUP_RETENTION_MONTHS`, because this is a
legal decision rather than a technical constant.

---

## 6. Data subject rights

| Right | Status |
|---|---|
| Access | **Manual.** Operator exports from the Convex dashboard |
| Rectification | Partial — users can edit their own profile and listing |
| Erasure | **Manual.** Procedure in `docs/RUNBOOKS.md` §5 |
| Restriction | Partial — an account can be suspended; a listing withdrawn instantly |
| Portability | **Manual** |
| Objection to outreach | Structural — outreach is disabled, and suppressions are permanent |

> **The significant gap.** There is no self-service account deletion and no
> scripted erasure. Under a GDPR frame, erasure carries a one-month statutory
> deadline, and a manual dashboard procedure is slow and error-prone at any
> volume. `users:deleteMyAccount` should be built before this deployment holds
> records for a meaningful number of people.

---

## 7. Processors and transfers

| Processor | Purpose | Location |
|---|---|---|
| Convex | Database, functions, auth | US (check your deployment region) |
| GitHub Pages | Static site hosting | Global CDN |
| Resend / Postmark / SendGrid | Transactional email, if configured | US |
| OpenAI / Anthropic / others | Drafting and translation, if configured | US |
| Exa / Tavily / Brave | Investor discovery, if configured | US |

Every optional processor is genuinely optional: an unconfigured capability
reports itself as unconfigured rather than degrading to a fabricated result, so
a deployment that configures nothing shares data with nobody but Convex and
GitHub.

> Data Processing Agreements: `[OPERATOR: not reviewed]`
> Standard Contractual Clauses for transfers: `[OPERATOR: not reviewed]`

---

## 8. Breach response

`docs/RUNBOOKS.md` covers detection. The notification obligation depends on §2 —
72 hours under GDPR, 48 under Rwandan law — and cannot be planned for until the
jurisdiction is chosen.

> Breach notification procedure: `[OPERATOR: not written]`

---

## 9. Open decisions, collected

Everything blocking a launch that collects real personal data at volume:

1. Name the controller and publish a monitored privacy contact. (§1)
2. Choose the jurisdiction. (§2)
3. Confirm the lawful basis mapping; write the outreach LIA before enabling
   outbound. (§4)
4. Review DPAs and transfer mechanisms for each configured processor. (§7)
5. Write the breach notification procedure against the chosen regime. (§8)
6. Build self-service erasure, or accept the manual procedure and its deadline
   risk. (§6)
7. Choose and document an off-vendor backup location. (`RUNBOOKS.md` §1)
8. Run the restore rehearsal at least once. (`RUNBOOKS.md` §2)
9. Purge the orphaned pre-migration auth tables on every deployment.
   (`RUNBOOKS.md` §7)

Items 1–5 need a person, not a commit. Items 6–8 are engineering work that is
specified but not done.
