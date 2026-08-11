import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const accountRole = v.union(v.literal("participant"), v.literal("investor"), v.literal("admin"));

const investorType = v.union(
  v.literal("angel"),
  v.literal("syndicate"),
  v.literal("venture"),
  v.literal("corporate"),
  v.literal("family-office"),
  v.literal("development-finance"),
  v.literal("limited-partner"),
  v.literal("accelerator"),
);

const participantKind = v.union(v.literal("startup"), v.literal("institution"), v.literal("individual"));

export default defineSchema({
  ...authTables,

  // Overrides authTables.users to carry the role model. Every field Convex
  // Auth itself reads (email, phone, the two verification times, isAnonymous,
  // name, image) is preserved verbatim along with both required indexes —
  // dropping any of them silently breaks sign-in rather than failing loudly.
  //
  // `role` is intentionally not optional: a user document with no role would
  // be a user no authorization check can reason about, so the provider sets it
  // at creation time and nothing else may clear it.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    role: accountRole,
    investorType: v.optional(investorType),
    participantKind: v.optional(participantKind),
    organizationName: v.optional(v.string()),
    location: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
    // Set when an admin suspends an account. Checked by every authz helper, so
    // a suspension takes effect on the next request without waiting for the
    // user's existing session to expire.
    suspendedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_role", ["role"]),

  // TOTP enrolment, kept out of `users` so that the shared "who am I" query
  // can return a whole user document without ever risking the shared secret
  // travelling to a browser.
  userMfa: defineTable({
    userId: v.id("users"),
    secret: v.string(),
    enabled: v.boolean(),
    confirmedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Step-up authentication, recorded per Convex Auth session rather than per
  // user: proving possession of the authenticator on a laptop must not silently
  // satisfy the MFA requirement for a session opened on another device.
  sessionMfaVerifications: defineTable({
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    verifiedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_session", ["sessionId"]).index("by_expiry", ["expiresAt"]),

  // Per-user onboarding progress. Stored as explicit completed/dismissed step
  // ids rather than a numeric "step 3 of 5" so that inserting a new onboarding
  // card later cannot retroactively un-complete anyone's checklist.
  onboardingState: defineTable({
    userId: v.id("users"),
    completedSteps: v.array(v.string()),
    dismissedPanels: v.array(v.string()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  interestSignups: defineTable({
    accountType: v.union(v.literal("startup"), v.literal("institution"), v.literal("individual")),
    name: v.string(),
    email: v.string(),
    location: v.string(),
    organizationName: v.optional(v.string()),
    website: v.optional(v.string()),
    individualRole: v.optional(v.union(v.literal("founder"), v.literal("investor"), v.literal("operator"), v.literal("advisor"), v.literal("researcher"), v.literal("other"))),
    stage: v.optional(v.union(v.literal("pre-seed"), v.literal("seed"), v.literal("series-a"), v.literal("series-b+"), v.literal("growth"), v.literal("institutional"))),
    summary: v.string(),
    context: v.string(),
    goals: v.array(v.union(v.literal("raise-capital"), v.literal("find-investors"), v.literal("join-catalogue"), v.literal("invest"), v.literal("mentor"), v.literal("partner"), v.literal("research"))),
    targetRegions: v.array(v.union(v.literal("US"), v.literal("UK"), v.literal("EU"), v.literal("APAC"))),
    referralSource: v.union(v.literal("search"), v.literal("social"), v.literal("community"), v.literal("referral"), v.literal("event"), v.literal("other")),
    productUpdates: v.boolean(),
    status: v.union(v.literal("new"), v.literal("reviewing"), v.literal("invited"), v.literal("active"), v.literal("declined")),
    source: v.string(),
    consentRecordedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    submissionCount: v.number(),
    // Claimed by the account that later signs up with the same address, which
    // is how a participant's dashboard finds their own intake record without
    // the client ever naming an email.
    userId: v.optional(v.id("users")),
  })
    .index("by_email", ["email"])
    .index("by_status_time", ["status", "createdAt"])
    .index("by_user", ["userId"]),
  organizations: defineTable({ name: v.string(), slug: v.string(), createdBy: v.string(), createdAt: v.number() }).index("by_slug", ["slug"]),
  memberships: defineTable({ organizationId: v.id("organizations"), userId: v.id("users"), role: v.union(v.literal("owner"), v.literal("reviewer"), v.literal("member")) }).index("by_org_user", ["organizationId", "userId"]).index("by_user", ["userId"]),
  startupProfiles: defineTable({ organizationId: v.id("organizations"), organizationType: v.union(v.literal("startup"), v.literal("institution")), name: v.string(), website: v.string(), location: v.string(), region: v.string(), stage: v.string(), sectors: v.array(v.string()), raiseAmountUsd: v.number(), oneLiner: v.string(), traction: v.string(), impact: v.string(), founderContext: v.string(), targetRegions: v.array(v.string()), status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived")), consentRecordedAt: v.number(), updatedAt: v.number() }).index("by_organization", ["organizationId"]),
  sources: defineTable({ organizationId: v.id("organizations"), url: v.string(), title: v.optional(v.string()), provider: v.union(v.literal("exa"), v.literal("manual")), providerRequestId: v.optional(v.string()), capturedAt: v.number(), excerpt: v.optional(v.string()), contentHash: v.optional(v.string()) }).index("by_url", ["url"]).index("by_organization_url", ["organizationId", "url"]),
  investors: defineTable({ organizationId: v.id("organizations"), firm: v.string(), person: v.optional(v.string()), role: v.optional(v.string()), region: v.string(), website: v.string(), email: v.optional(v.string()), contactType: v.union(v.literal("generic_business"), v.literal("named_business"), v.literal("unknown")), thesis: v.string(), stages: v.array(v.string()), sectors: v.array(v.string()), geographies: v.array(v.string()), sourceIds: v.array(v.id("sources")), lastVerifiedAt: v.number() }).index("by_org_firm", ["organizationId", "firm"]),
  campaigns: defineTable({ organizationId: v.id("organizations"), startupProfileId: v.id("startupProfiles"), name: v.string(), status: v.union(v.literal("draft"), v.literal("review"), v.literal("approved"), v.literal("running"), v.literal("paused"), v.literal("complete")), dailyLimit: v.number(), createdBy: v.string(), createdAt: v.number() }).index("by_organization", ["organizationId"]),
  matches: defineTable({ campaignId: v.id("campaigns"), investorId: v.id("investors"), score: v.number(), reasons: v.array(v.string()), risks: v.array(v.string()), model: v.optional(v.string()), promptVersion: v.optional(v.string()), createdAt: v.number() }).index("by_campaign_score", ["campaignId", "score"]),
  catalogueListings: defineTable({ organizationId: v.id("organizations"), startupProfileId: v.id("startupProfiles"), visibility: v.union(v.literal("private"), v.literal("review"), v.literal("listed")), publicContext: v.string(), publicStrengths: v.array(v.string()), publicConsiderations: v.array(v.string()), publicTraction: v.string(), approvedBy: v.optional(v.string()), approvedAt: v.optional(v.number()), updatedAt: v.number() }).index("by_visibility", ["visibility"]).index("by_organization", ["organizationId"]),
  investorInterests: defineTable({ listingId: v.id("catalogueListings"), investorOrganizationId: v.id("organizations"), investorUserId: v.string(), note: v.optional(v.string()), status: v.union(v.literal("submitted"), v.literal("shared"), v.literal("accepted"), v.literal("declined")), createdAt: v.number() }).index("by_listing", ["listingId"]).index("by_investor", ["investorOrganizationId"]),
  messages: defineTable({ campaignId: v.id("campaigns"), investorId: v.id("investors"), subject: v.string(), body: v.string(), status: v.union(v.literal("draft"), v.literal("approved"), v.literal("queued"), v.literal("sent"), v.literal("failed"), v.literal("suppressed")), approvedBy: v.optional(v.string()), approvedAt: v.optional(v.number()), providerMessageId: v.optional(v.string()), idempotencyKey: v.string(), createdAt: v.number() }).index("by_campaign", ["campaignId"]).index("by_idempotency", ["idempotencyKey"]),
  suppressions: defineTable({ emailHash: v.string(), reason: v.union(v.literal("unsubscribe"), v.literal("bounce"), v.literal("complaint"), v.literal("manual")), createdAt: v.number(), source: v.string() }).index("by_email_hash", ["emailHash"]),
  webhookEvents: defineTable({ provider: v.string(), eventId: v.string(), type: v.string(), payload: v.any(), receivedAt: v.number() }).index("by_provider_event", ["provider", "eventId"]),
  auditEvents: defineTable({ organizationId: v.id("organizations"), actorId: v.string(), action: v.string(), entityType: v.string(), entityId: v.string(), metadata: v.optional(v.any()), createdAt: v.number() }).index("by_organization_time", ["organizationId", "createdAt"]),
  workflowRuns: defineTable({
    organizationId: v.id("organizations"),
    campaignId: v.id("campaigns"),
    kind: v.literal("investor_research"),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("blocked"), v.literal("failed"), v.literal("cancelled")),
    requestedBy: v.string(),
    idempotencyKey: v.string(),
    budgetUsd: v.number(),
    spentUsd: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org_idempotency", ["organizationId", "idempotencyKey"]).index("by_campaign_time", ["campaignId", "createdAt"]),
  workflowSteps: defineTable({
    runId: v.id("workflowRuns"),
    kind: v.literal("investor_research"),
    status: v.union(v.literal("pending"), v.literal("leased"), v.literal("running"), v.literal("succeeded"), v.literal("blocked"), v.literal("failed"), v.literal("cancelled")),
    input: v.any(),
    attempt: v.number(),
    maxAttempts: v.number(),
    availableAt: v.number(),
    leaseTokenHash: v.optional(v.string()),
    leaseOwner: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    sandboxId: v.optional(v.string()),
    outputDigest: v.optional(v.string()),
    blockerCode: v.optional(v.string()),
    safeMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_run", ["runId"]).index("by_status_available", ["status", "availableAt"]).index("by_status_lease", ["status", "leaseExpiresAt"]),
  workflowArtifacts: defineTable({
    organizationId: v.id("organizations"),
    runId: v.id("workflowRuns"),
    stepId: v.id("workflowSteps"),
    outputType: v.union(v.literal("research_plan"), v.literal("discovery"), v.literal("evidence"), v.literal("normalization"), v.literal("matching"), v.literal("draft")),
    sha256: v.string(),
    payload: v.any(),
    sourceManifest: v.array(v.object({ url: v.string(), capturedAt: v.number(), contentSha256: v.string() })),
    usage: v.object({ durationMs: v.number(), providerCalls: v.number(), inputBytes: v.number(), outputBytes: v.number() }),
    templateVersion: v.string(),
    workerVersion: v.string(),
    createdAt: v.number(),
  }).index("by_run", ["runId"]).index("by_step_digest", ["stepId", "sha256"]),
  providerOperations: defineTable({
    organizationId: v.id("organizations"),
    runId: v.id("workflowRuns"),
    stepId: v.id("workflowSteps"),
    provider: v.literal("exa"),
    operationKey: v.string(),
    requestDigest: v.string(),
    status: v.union(v.literal("reserved"), v.literal("succeeded"), v.literal("failed")),
    reservedCostUsd: v.number(),
    actualCostUsd: v.optional(v.number()),
    providerRequestId: v.optional(v.string()),
    response: v.optional(v.any()),
    safeErrorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_step_operation", ["stepId", "operationKey"]).index("by_organization_time", ["organizationId", "createdAt"]),
  researchCandidates: defineTable({
    organizationId: v.id("organizations"), runId: v.id("workflowRuns"), sourceId: v.id("sources"),
    dedupeKey: v.string(), displayName: v.string(), website: v.string(), evidenceExcerpt: v.optional(v.string()),
    status: v.union(v.literal("unreviewed"), v.literal("verified"), v.literal("rejected")),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_organization_dedupe", ["organizationId", "dedupeKey"]).index("by_run", ["runId"]),
  // Real, persisted interest signals against the current static/preview
  // catalogue profiles (lib/catalogue-data.ts ids). Deliberately not tied to
  // `catalogueListings`/`organizations` yet since those require the
  // authenticated multi-tenant model this project has not built out.
  catalogueInterestSignals: defineTable({
    profileId: v.string(),
    email: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_profile_email", ["profileId", "email"]),

  // Accountability trail for privileged actions. `actorUserId` is a real
  // authenticated user rather than a bearer-secret holder, which is the whole
  // point of the Convex Auth migration: every entry here names someone.
  adminAuditLog: defineTable({
    actorUserId: v.id("users"),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_time", ["createdAt"]).index("by_actor", ["actorUserId"]),

  /**
   * Audit rows written by the pre-Convex-Auth admin system.
   *
   * Preserved rather than deleted. The old rows reference `adminUsers`, a table
   * the Convex Auth migration removed, so they cannot satisfy the new
   * `adminAuditLog` shape — but "application rollback must not roll back audit
   * state" (docs/DEPLOYMENT.md) applies just as much to a schema migration.
   * The actor is kept as an opaque string because the table it pointed at is
   * gone; `actorEmail` carries the human-readable identity forward.
   */
  legacyAdminAuditLog: defineTable({
    actorRef: v.string(),
    actorEmail: v.optional(v.string()),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    migratedAt: v.number(),
  }).index("by_time", ["createdAt"]),

  // Generic keyed limiter backing the public, unauthenticated surfaces
  // (signup submission, catalogue interest). Convex Auth ships its own
  // limiter for password attempts, so this no longer covers login.
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStartedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_key", ["key"]).index("by_expiry", ["expiresAt"]),
});
