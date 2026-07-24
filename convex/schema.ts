import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
  }).index("by_email", ["email"]).index("by_status_time", ["status", "createdAt"]),
  signupRateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStartedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_key", ["key"]).index("by_expiry", ["expiresAt"]),
  organizations: defineTable({ name: v.string(), slug: v.string(), createdBy: v.string(), createdAt: v.number() }).index("by_slug", ["slug"]),
  memberships: defineTable({ organizationId: v.id("organizations"), userId: v.string(), role: v.union(v.literal("owner"), v.literal("reviewer"), v.literal("member")) }).index("by_org_user", ["organizationId", "userId"]),
  startupProfiles: defineTable({ organizationId: v.id("organizations"), organizationType: v.union(v.literal("startup"), v.literal("institution")), name: v.string(), website: v.string(), location: v.string(), region: v.string(), stage: v.string(), sectors: v.array(v.string()), raiseAmountUsd: v.number(), oneLiner: v.string(), traction: v.string(), impact: v.string(), founderContext: v.string(), targetRegions: v.array(v.string()), status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived")), consentRecordedAt: v.number(), updatedAt: v.number() }).index("by_organization", ["organizationId"]),
  sources: defineTable({ organizationId: v.id("organizations"), url: v.string(), title: v.optional(v.string()), provider: v.union(v.literal("exa"), v.literal("manual")), providerRequestId: v.optional(v.string()), capturedAt: v.number(), excerpt: v.optional(v.string()), contentHash: v.optional(v.string()) }).index("by_url", ["url"]),
  investors: defineTable({ organizationId: v.id("organizations"), firm: v.string(), person: v.optional(v.string()), role: v.optional(v.string()), region: v.string(), website: v.string(), email: v.optional(v.string()), contactType: v.union(v.literal("generic_business"), v.literal("named_business"), v.literal("unknown")), thesis: v.string(), stages: v.array(v.string()), sectors: v.array(v.string()), geographies: v.array(v.string()), sourceIds: v.array(v.id("sources")), lastVerifiedAt: v.number() }).index("by_org_firm", ["organizationId", "firm"]),
  campaigns: defineTable({ organizationId: v.id("organizations"), startupProfileId: v.id("startupProfiles"), name: v.string(), status: v.union(v.literal("draft"), v.literal("review"), v.literal("approved"), v.literal("running"), v.literal("paused"), v.literal("complete")), dailyLimit: v.number(), createdBy: v.string(), createdAt: v.number() }).index("by_organization", ["organizationId"]),
  matches: defineTable({ campaignId: v.id("campaigns"), investorId: v.id("investors"), score: v.number(), reasons: v.array(v.string()), risks: v.array(v.string()), model: v.optional(v.string()), promptVersion: v.optional(v.string()), createdAt: v.number() }).index("by_campaign_score", ["campaignId", "score"]),
  catalogueListings: defineTable({ organizationId: v.id("organizations"), startupProfileId: v.id("startupProfiles"), visibility: v.union(v.literal("private"), v.literal("review"), v.literal("listed")), publicContext: v.string(), publicStrengths: v.array(v.string()), publicConsiderations: v.array(v.string()), publicTraction: v.string(), approvedBy: v.optional(v.string()), approvedAt: v.optional(v.number()), updatedAt: v.number() }).index("by_visibility", ["visibility"]).index("by_organization", ["organizationId"]),
  investorInterests: defineTable({ listingId: v.id("catalogueListings"), investorOrganizationId: v.id("organizations"), investorUserId: v.string(), note: v.optional(v.string()), status: v.union(v.literal("submitted"), v.literal("shared"), v.literal("accepted"), v.literal("declined")), createdAt: v.number() }).index("by_listing", ["listingId"]).index("by_investor", ["investorOrganizationId"]),
  messages: defineTable({ campaignId: v.id("campaigns"), investorId: v.id("investors"), subject: v.string(), body: v.string(), status: v.union(v.literal("draft"), v.literal("approved"), v.literal("queued"), v.literal("sent"), v.literal("failed"), v.literal("suppressed")), approvedBy: v.optional(v.string()), approvedAt: v.optional(v.number()), providerMessageId: v.optional(v.string()), idempotencyKey: v.string(), createdAt: v.number() }).index("by_campaign", ["campaignId"]).index("by_idempotency", ["idempotencyKey"]),
  suppressions: defineTable({ emailHash: v.string(), reason: v.union(v.literal("unsubscribe"), v.literal("bounce"), v.literal("complaint"), v.literal("manual")), createdAt: v.number(), source: v.string() }).index("by_email_hash", ["emailHash"]),
  webhookEvents: defineTable({ provider: v.string(), eventId: v.string(), type: v.string(), payload: v.any(), receivedAt: v.number() }).index("by_provider_event", ["provider", "eventId"]),
  auditEvents: defineTable({ organizationId: v.id("organizations"), actorId: v.string(), action: v.string(), entityType: v.string(), entityId: v.string(), metadata: v.optional(v.any()), createdAt: v.number() }).index("by_organization_time", ["organizationId", "createdAt"]),
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

  // Techadmin operator accounts. Password hashing (scrypt) happens in the
  // Next.js server route, which is the only place Node crypto is available;
  // this table only ever stores/compares the resulting hash string.
  adminUsers: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    role: v.literal("techadmin"),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
    // Set once enrollment starts, but mfaEnabled only flips true after the
    // admin proves possession of the authenticator app with a real code.
    mfaSecret: v.optional(v.string()),
    mfaEnabled: v.boolean(),
  }).index("by_email", ["email"]),

  // Bridges the gap between "password verified" and "session issued" once
  // MFA is enabled: single-use, five-minute-lived, never itself sufficient
  // to authenticate — only a valid TOTP code can consume one.
  adminMfaChallenges: defineTable({
    tokenHash: v.string(),
    adminUserId: v.id("adminUsers"),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token_hash", ["tokenHash"]).index("by_expiry", ["expiresAt"]),

  // Sessions are opaque, random tokens; only their SHA-256 hash is ever
  // stored, so a database read alone can never yield a usable session.
  adminSessions: defineTable({
    tokenHash: v.string(),
    adminUserId: v.id("adminUsers"),
    createdAt: v.number(),
    expiresAt: v.number(),
    userAgent: v.optional(v.string()),
  }).index("by_token_hash", ["tokenHash"]).index("by_expiry", ["expiresAt"]),

  adminLoginAttempts: defineTable({
    key: v.string(),
    count: v.number(),
    windowStartedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_key", ["key"]).index("by_expiry", ["expiresAt"]),

  // Accountability trail for status changes made through the techadmin
  // pipeline view.
  adminAuditLog: defineTable({
    adminUserId: v.id("adminUsers"),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_time", ["createdAt"]),

  // A deliberately separate, low-privilege login surface from adminUsers:
  // a founder account can only ever read its own interestSignups record
  // (matched by email at query time), never anyone else's data or any
  // platform-wide metric. Gated by its own secret (FOUNDER_ACTION_SECRET)
  // so a leak here can never be used to reach the techadmin surface.
  founderAccounts: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  founderSessions: defineTable({
    tokenHash: v.string(),
    founderAccountId: v.id("founderAccounts"),
    createdAt: v.number(),
    expiresAt: v.number(),
    userAgent: v.optional(v.string()),
  }).index("by_token_hash", ["tokenHash"]).index("by_expiry", ["expiresAt"]),

  founderLoginAttempts: defineTable({
    key: v.string(),
    count: v.number(),
    windowStartedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_key", ["key"]).index("by_expiry", ["expiresAt"]),
});
