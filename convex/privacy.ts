import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { recordAudit, requireAdmin, requireUser } from "./authz";

const requestKind = v.union(
  v.literal("access"),
  v.literal("correction"),
  v.literal("deletion"),
  v.literal("restriction"),
  v.literal("objection"),
  v.literal("appeal"),
);
const jurisdiction = v.union(
  v.literal("US"),
  v.literal("UK"),
  v.literal("EU"),
  v.literal("APAC"),
  v.literal("OTHER"),
);
const requestStatus = v.union(
  v.literal("submitted"),
  v.literal("in_review"),
  v.literal("completed"),
  v.literal("denied"),
  v.literal("cancelled"),
);

const requestRecord = v.object({
  _id: v.id("privacyRequests"),
  _creationTime: v.number(),
  userId: v.id("users"),
  kind: requestKind,
  jurisdiction,
  details: v.optional(v.string()),
  status: requestStatus,
  submittedAt: v.number(),
  updatedAt: v.number(),
  resolvedAt: v.optional(v.number()),
  response: v.optional(v.string()),
});

export const myRequests = query({
  args: {},
  returns: v.array(requestRecord),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return ctx.db
      .query("privacyRequests")
      .withIndex("by_user_and_submitted_at", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});

export const submitRequest = mutation({
  args: { kind: requestKind, jurisdiction, details: v.string() },
  returns: v.object({ requestId: v.id("privacyRequests"), status: v.literal("submitted") }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const details = args.details.trim().slice(0, 2000);
    const recent = await ctx.db
      .query("privacyRequests")
      .withIndex("by_user_and_kind", (q) => q.eq("userId", user._id).eq("kind", args.kind))
      .order("desc")
      .first();
    if (recent && (recent.status === "submitted" || recent.status === "in_review")) {
      throw new Error("A request of this type is already open");
    }
    const now = Date.now();
    const requestId = await ctx.db.insert("privacyRequests", {
      userId: user._id,
      kind: args.kind,
      jurisdiction: args.jurisdiction,
      details: details || undefined,
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
    });
    return { requestId, status: "submitted" as const };
  },
});

export const cancelRequest = mutation({
  args: { requestId: v.id("privacyRequests") },
  returns: v.object({ cancelled: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get("privacyRequests", args.requestId);
    if (!request || request.userId !== user._id) throw new Error("FORBIDDEN");
    if (request.status !== "submitted") return { cancelled: false };
    const now = Date.now();
    await ctx.db.patch(request._id, { status: "cancelled", updatedAt: now, resolvedAt: now });
    return { cancelled: true };
  },
});

/** A bounded machine-readable copy of personal data directly tied to the caller. */
export const myDataExport = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const signup = await ctx.db
      .query("interestSignups")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const onboarding = await ctx.db
      .query("onboardingState")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100);
    const membershipData = await Promise.all(
      memberships.map(async (membership) => {
        const organization = await ctx.db.get("organizations", membership.organizationId);
        return {
          organizationId: membership.organizationId,
          organizationName: organization?.name ?? null,
          role: membership.role,
        };
      }),
    );
    const interests = await ctx.db
      .query("investorInterests")
      .withIndex("by_investor_user", (q) => q.eq("investorUserId", String(user._id)))
      .order("desc")
      .take(500);
    const requests = await ctx.db
      .query("privacyRequests")
      .withIndex("by_user_and_submitted_at", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);

    return {
      format: "firstcontact-personal-data-export-v1",
      account: {
        id: user._id,
        email: user.email ?? null,
        name: user.name ?? null,
        role: user.role,
        investorType: user.investorType ?? null,
        participantKind: user.participantKind ?? null,
        organizationName: user.organizationName ?? null,
        location: user.location ?? null,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt ?? null,
        suspendedAt: user.suspendedAt ?? null,
      },
      signup: signup ?? null,
      onboarding: onboarding ?? null,
      memberships: membershipData,
      investorInterests: interests,
      privacyRequests: requests,
      excludedSecurityData: [
        "password hashes and authentication provider secrets",
        "sessions and verification tokens",
        "MFA secrets",
        "other users' and organizations' private records",
      ],
    };
  },
});

export const listRequests = query({
  args: { status: requestStatus },
  returns: v.array(v.object({ request: requestRecord, userEmail: v.union(v.string(), v.null()), userName: v.union(v.string(), v.null()) })),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const requests = await ctx.db
      .query("privacyRequests")
      .withIndex("by_status_and_submitted_at", (q) => q.eq("status", args.status))
      .order("asc")
      .take(200);
    return Promise.all(requests.map(async (request) => {
      const user = await ctx.db.get("users", request.userId);
      return { request, userEmail: user?.email ?? null, userName: user?.name ?? null };
    }));
  },
});

export const resolveRequest = mutation({
  args: {
    requestId: v.id("privacyRequests"),
    status: v.union(v.literal("in_review"), v.literal("completed"), v.literal("denied")),
    response: v.string(),
  },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const request = await ctx.db.get("privacyRequests", args.requestId);
    if (!request) throw new Error("Request not found");
    const response = args.response.trim().slice(0, 4000);
    if ((args.status === "completed" || args.status === "denied") && !response) {
      throw new Error("A response is required when closing a request");
    }
    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: args.status,
      response: response || undefined,
      updatedAt: now,
      resolvedAt: args.status === "in_review" ? undefined : now,
    });
    await recordAudit(ctx, admin._id, {
      action: "privacy_request.updated",
      targetType: "privacyRequest",
      targetId: String(request._id),
      metadata: { status: args.status },
    });
    return { updated: true };
  },
});
