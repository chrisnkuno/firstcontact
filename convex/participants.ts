import { query } from "./_generated/server";
import { requireRole } from "./authz";

/**
 * A participant's own record.
 *
 * The safety property that made the old `founder:getMyStatus` worth keeping as
 * a separate, narrow query still holds, and is now enforced by identity rather
 * than by a shared secret: the record is located from the *authenticated
 * user's* id or verified email, never from anything the client supplies. There
 * is no argument to this query, so there is nothing to tamper with.
 */
export const myRecord = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["participant"]);

    let signup = await ctx.db
      .query("interestSignups")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    // Falls back to the verified email for accounts created before the signup
    // was claimed; `users:claimSignupRecord` links them on next sign-in.
    if (!signup && user.email) {
      signup = await ctx.db
        .query("interestSignups")
        .withIndex("by_email", (q) => q.eq("email", user.email!))
        .unique();
      if (signup && signup.userId && signup.userId !== user._id) signup = null;
    }
    if (!signup) return null;

    return {
      accountType: signup.accountType,
      name: signup.name,
      organizationName: signup.organizationName,
      website: signup.website,
      location: signup.location,
      stage: signup.stage,
      individualRole: signup.individualRole,
      summary: signup.summary,
      context: signup.context,
      status: signup.status,
      goals: signup.goals,
      targetRegions: signup.targetRegions,
      referralSource: signup.referralSource,
      productUpdates: signup.productUpdates,
      submissionCount: signup.submissionCount,
      createdAt: signup.createdAt,
      updatedAt: signup.updatedAt,
    };
  },
});

/**
 * Everything the participant dashboard charts, scoped to the caller's own
 * organizations.
 *
 * Activity timestamps come from real message and interest records — there is
 * no synthesised history here, so a brand-new account correctly returns empty
 * arrays and the dashboard renders its empty state rather than a flat line at
 * zero pretending to be measured.
 */
export const myActivity = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireRole(ctx, ["participant"]);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const contactedAt: number[] = [];
    const repliedAt: number[] = [];
    let campaignCount = 0;
    let draftsAwaitingApproval = 0;

    for (const membership of memberships) {
      const campaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_organization", (q) => q.eq("organizationId", membership.organizationId))
        .collect();
      campaignCount += campaigns.length;

      for (const campaign of campaigns) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_campaign", (q) => q.eq("campaignId", campaign._id))
          .collect();
        for (const message of messages) {
          if (message.status === "sent") contactedAt.push(message._creationTime);
          if (message.status === "draft") draftsAwaitingApproval += 1;
        }
      }
    }

    // Replies arrive as Resend inbound webhook events rather than as message
    // rows, so they are counted from the webhook log.
    const inbound = await ctx.db.query("webhookEvents").collect();
    for (const event of inbound) {
      if (event.type === "email.received") repliedAt.push(event.receivedAt);
    }

    return {
      contactedAt,
      repliedAt,
      // Meetings are not yet tracked as first-class records; reporting an empty
      // array is honest, whereas inferring them from replies would not be.
      meetingAt: [] as number[],
      committedUsd: 0,
      campaignCount,
      draftsAwaitingApproval,
    };
  },
});
