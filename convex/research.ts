import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMembership } from "./authz";
import { scoreInvestor } from "../lib/matching";
import type { Investor, StartupProfile } from "../lib/domain";

/**
 * The link between automated research and outreach.
 *
 * The E2B worker's discovery step writes `researchCandidates` — URLs with
 * evidence, marked `unreviewed`. Nothing downstream may consume them until a
 * person promotes one into an `investors` record. That gate is deliberate and
 * is the reason this module exists as a separate step rather than the worker
 * writing investors directly:
 *
 *   a model deciding "this page is a venture fund that invests at seed in
 *   climate" is a *claim*, and the product's whole position is that claims
 *   about real third parties get checked by a human before anyone is contacted
 *   on the strength of them.
 *
 * So the chain is: discover → candidates → **human verification** → investors →
 * scored matches → drafts → **human approval** → send. Two human gates, one at
 * each end, with automation in between.
 */

export const listCandidates = query({
  args: { organizationId: v.id("organizations"), status: v.optional(v.union(v.literal("unreviewed"), v.literal("verified"), v.literal("rejected"))) },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId);

    const candidates = await ctx.db
      .query("researchCandidates")
      .withIndex("by_organization_dedupe", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const filtered = args.status
      ? candidates.filter((candidate) => candidate.status === args.status)
      : candidates;

    return Promise.all(
      filtered.map(async (candidate) => {
        const source = await ctx.db.get(candidate.sourceId);
        return {
          id: candidate._id,
          displayName: candidate.displayName,
          website: candidate.website,
          evidenceExcerpt: candidate.evidenceExcerpt ?? null,
          status: candidate.status,
          createdAt: candidate.createdAt,
          sourceUrl: source?.url ?? null,
          sourceCapturedAt: source?.capturedAt ?? null,
        };
      }),
    );
  },
});

/**
 * Promotes a reviewed candidate into a contactable investor record.
 *
 * The reviewer supplies the structured facts (thesis, stages, sectors,
 * geographies) rather than the model, because these are exactly the fields the
 * matching score and the draft will treat as true. `contactType` is required
 * and has no default: whether an address is a generic business inbox or a named
 * individual determines which jurisdictions' rules apply, and guessing it wrong
 * is the difference between lawful outreach and unlawful outreach.
 */
export const verifyCandidate = mutation({
  args: {
    candidateId: v.id("researchCandidates"),
    firm: v.string(),
    region: v.union(v.literal("US"), v.literal("UK"), v.literal("EU"), v.literal("APAC")),
    thesis: v.string(),
    stages: v.array(v.string()),
    sectors: v.array(v.string()),
    geographies: v.array(v.string()),
    email: v.optional(v.string()),
    person: v.optional(v.string()),
    role: v.optional(v.string()),
    contactType: v.union(
      v.literal("generic_business"),
      v.literal("named_business"),
      v.literal("unknown"),
    ),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error("Candidate not found");

    // Verification is an owner/reviewer act, not something any member can do.
    const { user } = await requireMembership(ctx, candidate.organizationId, ["owner", "reviewer"]);

    const existing = await ctx.db
      .query("investors")
      .withIndex("by_org_firm", (q) =>
        q.eq("organizationId", candidate.organizationId).eq("firm", args.firm.trim()),
      )
      .unique();

    const fields = {
      organizationId: candidate.organizationId,
      firm: args.firm.trim(),
      person: args.person?.trim() || undefined,
      role: args.role?.trim() || undefined,
      region: args.region,
      website: candidate.website,
      email: args.email?.trim().toLowerCase() || undefined,
      contactType: args.contactType,
      thesis: args.thesis.trim(),
      stages: args.stages,
      sectors: args.sectors,
      geographies: args.geographies,
      // Every investor keeps a pointer to the page it was found on, so a draft
      // referring to their thesis can always be traced to evidence.
      sourceIds: [candidate.sourceId],
      lastVerifiedAt: Date.now(),
    };

    const investorId = existing ? existing._id : await ctx.db.insert("investors", fields);
    if (existing) await ctx.db.patch(existing._id, fields);

    await ctx.db.patch(candidate._id, { status: "verified", updatedAt: Date.now() });
    await ctx.db.insert("auditEvents", {
      organizationId: candidate.organizationId,
      actorId: user._id,
      action: "research.candidate_verified",
      entityType: "investors",
      entityId: investorId,
      metadata: { candidateId: candidate._id, contactType: args.contactType },
      createdAt: Date.now(),
    });

    return { investorId, created: !existing };
  },
});

export const rejectCandidate = mutation({
  args: { candidateId: v.id("researchCandidates"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error("Candidate not found");
    const { user } = await requireMembership(ctx, candidate.organizationId, ["owner", "reviewer"]);

    await ctx.db.patch(candidate._id, { status: "rejected", updatedAt: Date.now() });
    await ctx.db.insert("auditEvents", {
      organizationId: candidate.organizationId,
      actorId: user._id,
      action: "research.candidate_rejected",
      entityType: "researchCandidates",
      entityId: candidate._id,
      metadata: { reason: args.reason?.slice(0, 500) },
      createdAt: Date.now(),
    });
    return { rejected: true };
  },
});

/**
 * Scores every verified investor against the campaign's profile.
 *
 * Uses the same `scoreInvestor` function the rest of the codebase does, so a
 * score shown on a dashboard and a score used to order a review queue can never
 * diverge. Rescoring replaces prior matches for the campaign rather than
 * appending, because a stale score from an earlier profile revision is worse
 * than no score.
 */
export const scoreCampaignMatches = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await requireMembership(ctx, campaign.organizationId, ["owner", "member"]);

    const profileDoc = await ctx.db.get(campaign.startupProfileId);
    if (!profileDoc) throw new Error("Campaign has no startup profile");

    const investors = await ctx.db
      .query("investors")
      .withIndex("by_org_firm", (q) => q.eq("organizationId", campaign.organizationId))
      .collect();

    const existingMatches = await ctx.db
      .query("matches")
      .withIndex("by_campaign_score", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    for (const match of existingMatches) await ctx.db.delete(match._id);

    const profile = {
      name: profileDoc.name,
      organizationType: profileDoc.organizationType,
      website: profileDoc.website,
      location: profileDoc.location,
      region: profileDoc.region,
      stage: profileDoc.stage,
      sectors: profileDoc.sectors,
      raiseAmountUsd: profileDoc.raiseAmountUsd,
      oneLiner: profileDoc.oneLiner,
      traction: profileDoc.traction,
      impact: profileDoc.impact,
      founderContext: profileDoc.founderContext,
      targetRegions: profileDoc.targetRegions,
      consentToProcess: true,
    } as StartupProfile;

    let scored = 0;
    for (const investor of investors) {
      const scoredMatch = scoreInvestor(profile, {
        id: investor._id,
        firm: investor.firm,
        person: investor.person,
        role: investor.role,
        region: investor.region,
        website: investor.website,
        sourceUrl: investor.website,
        thesis: investor.thesis,
        stages: investor.stages,
        sectors: investor.sectors,
        geographies: investor.geographies,
        email: investor.email,
        contactType: investor.contactType,
        evidence: [],
        discoveredAt: new Date(investor.lastVerifiedAt).toISOString(),
      } as Investor);

      await ctx.db.insert("matches", {
        campaignId: args.campaignId,
        investorId: investor._id,
        score: scoredMatch.score,
        reasons: scoredMatch.reasons,
        risks: scoredMatch.risks,
        createdAt: Date.now(),
      });
      scored += 1;
    }

    return { scored };
  },
});

export const listMatches = query({
  args: { campaignId: v.id("campaigns"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await requireMembership(ctx, campaign.organizationId);

    const matches = await ctx.db
      .query("matches")
      .withIndex("by_campaign_score", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));

    return Promise.all(
      matches.map(async (match) => {
        const investor = await ctx.db.get(match.investorId);
        return {
          id: match._id,
          investorId: match.investorId,
          score: match.score,
          reasons: match.reasons,
          risks: match.risks,
          firm: investor?.firm ?? null,
          region: investor?.region ?? null,
          thesis: investor?.thesis ?? null,
          contactType: investor?.contactType ?? null,
          hasEmail: Boolean(investor?.email),
        };
      }),
    );
  },
});

/** Run state for the campaign view, so a founder can see research progress. */
export const listRuns = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await requireMembership(ctx, campaign.organizationId);

    const runs = await ctx.db
      .query("workflowRuns")
      .withIndex("by_campaign_time", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .take(20);

    return Promise.all(
      runs.map(async (run) => {
        const steps = await ctx.db
          .query("workflowSteps")
          .withIndex("by_run", (q) => q.eq("runId", run._id))
          .collect();
        return {
          id: run._id,
          status: run.status,
          budgetUsd: run.budgetUsd,
          spentUsd: run.spentUsd,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          steps: steps.map((step) => ({
            id: step._id,
            status: step.status,
            attempt: step.attempt,
            maxAttempts: step.maxAttempts,
            // Only the safe, operator-authored message ever reaches a client —
            // never a raw provider or sandbox error.
            blockerCode: step.blockerCode ?? null,
            safeMessage: step.safeMessage ?? null,
          })),
        };
      }),
    );
  },
});
