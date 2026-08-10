import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireMembership, recordAudit } from "./authz";
import { evaluateContactPolicy } from "../lib/compliance";
import { hashEmail } from "../lib/email-hash";
import { exaSearch, openAiStructured, resendSend } from "./providers";

/**
 * The outreach agent surface: discover → draft → approve → send.
 *
 * Each step is a separate function on purpose. The approval boundary between
 * drafting and sending is the central safety property of this product — a
 * model may write a message, but only a person may send one — and that is only
 * enforceable if generating and delivering are distinct operations with
 * distinct authorization, rather than one "do outreach" call.
 */

const DEFAULT_MODEL = "gpt-5-nano";

/* ------------------------------------------------------------------ *
 * Discovery
 * ------------------------------------------------------------------ */

export const discover = action({
  args: { campaignId: v.id("campaigns"), query: v.optional(v.string()) },
  handler: async (ctx, args): Promise<
    | { mode: "unconfigured"; results: never[]; notice: string }
    | { mode: "live"; requestId?: string; results: unknown[] }
  > => {
    const context = await ctx.runQuery(internal.outreach.campaignContext, {
      campaignId: args.campaignId,
      requiredRoles: ["owner", "member"],
    });

    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      // No sample data. The previous implementation returned fabricated
      // "demo" investors here, which is precisely the failure mode this
      // codebase otherwise takes care to avoid — an unconfigured integration
      // now says so instead of inventing plausible firms.
      return {
        mode: "unconfigured",
        results: [],
        notice: "Investor discovery is not configured on this deployment.",
      };
    }

    const query =
      args.query ??
      `Venture capital firms investing at ${context.stage} in ${context.sectors.join(", ")} companies across ${context.region}, with verified portfolio or investment thesis evidence`;

    const result = await exaSearch({ apiKey, query });
    if (!result.ok) throw new Error(result.message);

    // Sources are persisted before any contact record exists, so every
    // investor that later appears in a campaign is traceable to the page it
    // came from and the moment it was captured.
    await ctx.runMutation(internal.outreach.recordSources, {
      organizationId: context.organizationId,
      results: result.data.results.map((entry) => ({
        url: entry.url ?? "",
        title: entry.title,
        excerpt: entry.highlights?.join(" — ").slice(0, 2000),
      })),
      providerRequestId: result.data.requestId,
    });

    return { mode: "live", requestId: result.data.requestId, results: result.data.results };
  },
});

export const campaignContext = internalQuery({
  args: {
    campaignId: v.id("campaigns"),
    requiredRoles: v.array(v.union(v.literal("owner"), v.literal("reviewer"), v.literal("member"))),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await requireMembership(ctx, campaign.organizationId, args.requiredRoles);

    const profile = await ctx.db.get(campaign.startupProfileId);
    if (!profile) throw new Error("Campaign has no startup profile");

    return {
      organizationId: campaign.organizationId,
      campaignName: campaign.name,
      dailyLimit: campaign.dailyLimit,
      name: profile.name,
      stage: profile.stage,
      sectors: profile.sectors,
      region: profile.region,
      oneLiner: profile.oneLiner,
      traction: profile.traction,
      founderContext: profile.founderContext,
    };
  },
});

export const recordSources = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    providerRequestId: v.optional(v.string()),
    results: v.array(
      v.object({ url: v.string(), title: v.optional(v.string()), excerpt: v.optional(v.string()) }),
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    for (const entry of args.results) {
      if (!entry.url) continue;
      const existing = await ctx.db
        .query("sources")
        .withIndex("by_organization_url", (q) =>
          q.eq("organizationId", args.organizationId).eq("url", entry.url),
        )
        .unique();
      if (existing) continue;

      await ctx.db.insert("sources", {
        organizationId: args.organizationId,
        url: entry.url,
        title: entry.title,
        provider: "exa",
        providerRequestId: args.providerRequestId,
        capturedAt: Date.now(),
        excerpt: entry.excerpt,
      });
      created += 1;
    }
    return { created };
  },
});

/* ------------------------------------------------------------------ *
 * Drafting
 * ------------------------------------------------------------------ */

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
    claimsToVerify: { type: "array", items: { type: "string" } },
  },
  required: ["subject", "body", "claimsToVerify"],
} as const;

export const draft = action({
  args: { campaignId: v.id("campaigns"), investorId: v.id("investors") },
  handler: async (
    ctx,
    args,
  ): Promise<{ messageId: Id<"messages">; subject: string; claimsToVerify: string[] }> => {
    const context = await ctx.runQuery(internal.outreach.campaignContext, {
      campaignId: args.campaignId,
      requiredRoles: ["owner", "member"],
    });
    const investor = await ctx.runQuery(internal.outreach.investorContext, {
      investorId: args.investorId,
      organizationId: context.organizationId,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Drafting is not configured on this deployment.");

    const result = await openAiStructured<{
      subject: string;
      body: string;
      claimsToVerify: string[];
    }>({
      apiKey,
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      instructions:
        "Draft a concise founder-to-investor introduction. Use only supplied facts. Never invent metrics, relationships, portfolio facts, or contact details. Be direct and specific. List every factual claim you made in claimsToVerify so a human can check it against the source.",
      input: {
        founder: {
          organization: context.name,
          oneLiner: context.oneLiner,
          traction: context.traction,
          context: context.founderContext,
        },
        investor: { firm: investor.firm, thesis: investor.thesis },
      },
      schemaName: "outreach_draft",
      schema: DRAFT_SCHEMA as unknown as Record<string, unknown>,
    });
    if (!result.ok) throw new Error(result.message);

    // Persisted as `draft`, never as `approved`. Nothing in this action can
    // produce a sendable message.
    const messageId = await ctx.runMutation(internal.outreach.storeDraft, {
      campaignId: args.campaignId,
      investorId: args.investorId,
      subject: result.data.subject,
      body: result.data.body,
    });

    return { messageId, subject: result.data.subject, claimsToVerify: result.data.claimsToVerify };
  },
});

export const investorContext = internalQuery({
  args: { investorId: v.id("investors"), organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const investor = await ctx.db.get(args.investorId);
    if (!investor || investor.organizationId !== args.organizationId) {
      throw new Error("Investor not found");
    }
    return {
      firm: investor.firm,
      thesis: investor.thesis,
      email: investor.email,
      contactType: investor.contactType,
      hasSource: investor.sourceIds.length > 0,
    };
  },
});

export const storeDraft = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    investorId: v.id("investors"),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // Keyed by campaign+investor so redrafting replaces rather than queues a
    // second message to the same person.
    const idempotencyKey = `draft:${args.campaignId}:${args.investorId}`;
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();

    if (existing) {
      if (existing.status === "sent") throw new Error("This investor has already been contacted");
      await ctx.db.patch(existing._id, {
        subject: args.subject,
        body: args.body,
        status: "draft",
        approvedBy: undefined,
        approvedAt: undefined,
      });
      return existing._id;
    }

    return ctx.db.insert("messages", {
      campaignId: args.campaignId,
      investorId: args.investorId,
      subject: args.subject,
      body: args.body,
      status: "draft",
      idempotencyKey,
      createdAt: Date.now(),
    });
  },
});

/* ------------------------------------------------------------------ *
 * Approval and delivery
 * ------------------------------------------------------------------ */

/**
 * Human approval.
 *
 * Requires the `reviewer` or `owner` organization role — deliberately not
 * `member`, so the person who generated a draft is not necessarily the person
 * who can release it.
 */
export const approveMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    const campaign = await ctx.db.get(message.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    const { user } = await requireMembership(ctx, campaign.organizationId, ["owner", "reviewer"]);
    if (message.status !== "draft") throw new Error("Only drafts can be approved");

    await ctx.db.patch(args.messageId, {
      status: "approved",
      approvedBy: user._id,
      approvedAt: Date.now(),
    });
    await recordAudit(ctx, user._id, {
      action: "message.approved",
      targetType: "messages",
      targetId: args.messageId,
    });
    return { approved: true };
  },
});

export const sendApproved = action({
  args: { messageId: v.id("messages"), unsubscribeUrl: v.string() },
  handler: async (ctx, args): Promise<{ status: string; providerMessageId: string | null }> => {
    const context = await ctx.runQuery(internal.outreach.sendContext, { messageId: args.messageId });

    const policy = evaluateContactPolicy({
      outboundEnabled: process.env.OUTBOUND_EMAIL_ENABLED === "true",
      approved: context.approved,
      hasSource: context.hasSource,
      isSuppressed: context.isSuppressed,
      contactType: context.contactType,
      jurisdictionReviewed: process.env.JURISDICTION_REVIEWED === "true",
      hasPostalIdentity: Boolean(process.env.SENDER_POSTAL_ADDRESS),
      hasUnsubscribe: Boolean(args.unsubscribeUrl),
    });
    if (!policy.allowed) {
      throw new Error(`Outbound policy blocked this message: ${policy.reasons.join("; ")}`);
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) throw new Error("Email delivery is not configured on this deployment.");
    if (!context.to) throw new Error("This investor has no contact address on record");

    const postalAddress = process.env.SENDER_POSTAL_ADDRESS!;
    const result = await resendSend({
      apiKey,
      from,
      to: context.to,
      subject: context.subject,
      text: `${context.body}\n\n${postalAddress}\nUnsubscribe: ${args.unsubscribeUrl}`,
      unsubscribeUrl: args.unsubscribeUrl,
      idempotencyKey: context.idempotencyKey,
    });

    if (!result.ok) {
      await ctx.runMutation(internal.outreach.markSendResult, {
        messageId: args.messageId,
        status: "failed",
      });
      throw new Error(result.message);
    }

    await ctx.runMutation(internal.outreach.markSendResult, {
      messageId: args.messageId,
      status: "sent",
      providerMessageId: result.data.id ?? undefined,
    });
    return { status: "sent", providerMessageId: result.data.id };
  },
});

export const sendContext = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    const campaign = await ctx.db.get(message.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await requireMembership(ctx, campaign.organizationId, ["owner"]);

    const investor = await ctx.db.get(message.investorId);
    if (!investor) throw new Error("Investor not found");

    const emailHash = investor.email ? await hashEmail(investor.email) : null;
    const isSuppressed =
      emailHash !== null &&
      (await ctx.db
        .query("suppressions")
        .withIndex("by_email_hash", (q) => q.eq("emailHash", emailHash))
        .unique()) !== null;

    return {
      to: investor.email ?? null,
      subject: message.subject,
      body: message.body,
      idempotencyKey: message.idempotencyKey,
      approved: message.status === "approved",
      contactType: investor.contactType,
      hasSource: investor.sourceIds.length > 0,
      isSuppressed,
    };
  },
});

export const markSendResult = internalMutation({
  args: {
    messageId: v.id("messages"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    providerMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      status: args.status,
      providerMessageId: args.providerMessageId,
    });
  },
});

/* ------------------------------------------------------------------ *
 * Reads for the campaign dashboard
 * ------------------------------------------------------------------ */

export const campaignMessages = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await requireMembership(ctx, campaign.organizationId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    return Promise.all(
      messages.map(async (message) => {
        const investor = await ctx.db.get(message.investorId);
        return {
          id: message._id,
          subject: message.subject,
          body: message.body,
          status: message.status,
          createdAt: message.createdAt,
          approvedAt: message.approvedAt ?? null,
          firm: investor?.firm ?? null,
          region: investor?.region ?? null,
          contactType: investor?.contactType ?? null,
        };
      }),
    );
  },
});
