import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { createUser } from "./convex-helpers";

const modules = import.meta.glob("../convex/**/*.ts");

const createOrganization = makeFunctionReference<
  "mutation",
  { name: string; slug: string },
  { organizationId: Id<"organizations"> }
>("organizations:create");
const createProfile = makeFunctionReference<
  "mutation",
  Record<string, unknown>,
  { startupProfileId: Id<"startupProfiles"> }
>("profiles:create");
const createCampaign = makeFunctionReference<
  "mutation",
  { organizationId: Id<"organizations">; startupProfileId: Id<"startupProfiles">; name: string; dailyLimit: number },
  { campaignId: Id<"campaigns"> }
>("campaigns:create");
const listCandidates = makeFunctionReference<
  "query",
  { organizationId: Id<"organizations">; status?: "unreviewed" | "verified" | "rejected" },
  { id: Id<"researchCandidates">; status: string }[]
>("research:listCandidates");
const verifyCandidate = makeFunctionReference<
  "mutation",
  Record<string, unknown>,
  { investorId: Id<"investors">; created: boolean }
>("research:verifyCandidate");
const scoreCampaignMatches = makeFunctionReference<
  "mutation",
  { campaignId: Id<"campaigns"> },
  { scored: number }
>("research:scoreCampaignMatches");
const listMatches = makeFunctionReference<
  "query",
  { campaignId: Id<"campaigns">; limit?: number },
  { score: number; firm: string | null; risks: string[] }[]
>("research:listMatches");

const profile = {
  organizationType: "startup",
  name: "Kivu Grid",
  website: "https://example.org",
  location: "Kigali, Rwanda",
  region: "Africa",
  stage: "seed",
  sectors: ["climate", "energy"],
  raiseAmountUsd: 1_500_000,
  oneLiner: "Distributed energy intelligence for commercial buildings.",
  traction: "Twenty paid sites and twelve months of measured operating data.",
  impact: "Lower energy cost and diesel use for growing businesses.",
  founderContext: "The team has operated regional infrastructure for ten years.",
  targetRegions: ["US", "UK", "EU"],
  consentToProcess: true,
};

async function setup() {
  const t = convexTest(schema, modules);
  const owner = await createUser(t, { role: "participant", email: "owner@example.org" });
  const { organizationId } = await owner.as.mutation(createOrganization, {
    name: "Kivu Grid",
    slug: "kivu-grid",
  });
  const { startupProfileId } = await owner.as.mutation(createProfile, { organizationId, ...profile });
  const { campaignId } = await owner.as.mutation(createCampaign, {
    organizationId,
    startupProfileId,
    name: "Seed research",
    dailyLimit: 10,
  });

  // Stands in for what the E2B discovery step writes.
  const candidateId = await t.run(async (ctx) => {
    const sourceId = await ctx.db.insert("sources", {
      organizationId,
      url: "https://climatefund.example/thesis",
      title: "Climate Fund",
      provider: "exa",
      capturedAt: Date.now(),
      excerpt: "We invest at seed in climate and energy companies across Africa.",
    });
    return ctx.db.insert("researchCandidates", {
      organizationId,
      runId: await ctx.db.insert("workflowRuns", {
        organizationId,
        campaignId,
        kind: "investor_research",
        status: "succeeded",
        requestedBy: owner.userId,
        idempotencyKey: "test-run-0001",
        budgetUsd: 5,
        spentUsd: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      sourceId,
      dedupeKey: "climatefund.example/thesis",
      displayName: "Climate Fund",
      website: "https://climatefund.example/thesis",
      evidenceExcerpt: "We invest at seed in climate and energy companies across Africa.",
      status: "unreviewed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return { t, owner, organizationId, campaignId, candidateId };
}

describe("research pipeline", () => {
  it("keeps discovered candidates unreviewed until a person verifies them", async () => {
    const { owner, organizationId, campaignId } = await setup();

    const candidates = await owner.as.query(listCandidates, { organizationId });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].status).toBe("unreviewed");

    // The safety property: an unreviewed candidate is not an investor, so
    // scoring finds nothing to contact.
    await expect(owner.as.mutation(scoreCampaignMatches, { campaignId })).resolves.toEqual({
      scored: 0,
    });
  });

  it("promotes a verified candidate into a scored, contactable investor", async () => {
    const { owner, organizationId, campaignId, candidateId } = await setup();

    const { created } = await owner.as.mutation(verifyCandidate, {
      candidateId,
      firm: "Climate Fund",
      region: "EU",
      thesis: "Seed-stage climate and energy across Africa.",
      stages: ["seed"],
      sectors: ["climate", "energy"],
      geographies: ["Africa"],
      email: "team@climatefund.example",
      contactType: "generic_business",
    });
    expect(created).toBe(true);

    expect(await owner.as.query(listCandidates, { organizationId, status: "verified" })).toHaveLength(1);

    const { scored } = await owner.as.mutation(scoreCampaignMatches, { campaignId });
    expect(scored).toBe(1);

    const matches = await owner.as.query(listMatches, { campaignId });
    expect(matches[0].firm).toBe("Climate Fund");
    // Stage, sector, geography and target-region all align, so this should
    // score near the top of the scale rather than at the 30-point floor.
    expect(matches[0].score).toBeGreaterThan(80);
    expect(matches[0].risks).toEqual([]);
  });

  it("replaces prior scores on rescore rather than accumulating stale ones", async () => {
    const { owner, campaignId, candidateId } = await setup();
    await owner.as.mutation(verifyCandidate, {
      candidateId,
      firm: "Climate Fund",
      region: "EU",
      thesis: "Seed-stage climate.",
      stages: ["seed"],
      sectors: ["climate"],
      geographies: ["Africa"],
      contactType: "generic_business",
    });

    await owner.as.mutation(scoreCampaignMatches, { campaignId });
    await owner.as.mutation(scoreCampaignMatches, { campaignId });

    expect(await owner.as.query(listMatches, { campaignId })).toHaveLength(1);
  });

  it("refuses verification to a member who is not an owner or reviewer", async () => {
    const { t, organizationId, candidateId } = await setup();
    const stranger = await createUser(t, { role: "participant", email: "stranger@example.org" });

    await expect(
      stranger.as.mutation(verifyCandidate, {
        candidateId,
        firm: "Climate Fund",
        region: "EU",
        thesis: "Seed-stage climate.",
        stages: ["seed"],
        sectors: ["climate"],
        geographies: ["Africa"],
        contactType: "generic_business",
      }),
    ).rejects.toThrow("FORBIDDEN");

    await expect(stranger.as.query(listCandidates, { organizationId })).rejects.toThrow("FORBIDDEN");
  });
});
