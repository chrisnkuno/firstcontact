import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const createOrganization = makeFunctionReference<"mutation", { name: string; slug: string }, { organizationId: Id<"organizations"> }>("organizations:create");
const addMember = makeFunctionReference<"mutation", { organizationId: Id<"organizations">; userId: string; role: "owner" | "reviewer" | "member" }, { created: boolean }>("organizations:addMember");
const createProfile = makeFunctionReference<"mutation", Record<string, unknown>, { startupProfileId: Id<"startupProfiles"> }>("profiles:create");
const activateProfile = makeFunctionReference<"mutation", { startupProfileId: Id<"startupProfiles"> }, void>("profiles:activate");
const listProfiles = makeFunctionReference<"query", { organizationId: Id<"organizations"> }, unknown[]>("profiles:list");
const createCampaign = makeFunctionReference<"mutation", { organizationId: Id<"organizations">; startupProfileId: Id<"startupProfiles">; name: string; dailyLimit: number }, { campaignId: Id<"campaigns"> }>("campaigns:create");
const transitionCampaign = makeFunctionReference<"mutation", { campaignId: Id<"campaigns">; action: "request_review" | "approve" | "start"; expectedStatus: "draft" | "review" | "approved" }, void>("campaigns:transition");
const createWorkflow = makeFunctionReference<"mutation", { campaignId: Id<"campaigns">; kind: "investor_research"; idempotencyKey: string; budgetUsd: number }, { runId: Id<"workflowRuns">; duplicate: boolean }>("workflows:createRun");
const getWorkflow = makeFunctionReference<"query", { runId: Id<"workflowRuns"> }, unknown>("workflows:getRun");

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

describe("Convex control-plane tenancy", () => {
  it("denies cross-tenant access and enforces role-scoped campaign transitions", async () => {
    const t = convexTest(schema, modules);
    const ownerId = "https://issuer.example|owner";
    const memberId = "https://issuer.example|member";
    const reviewerId = "https://issuer.example|reviewer";
    const outsiderId = "https://issuer.example|outsider";
    const owner = t.withIdentity({ tokenIdentifier: ownerId, subject: "owner", issuer: "https://issuer.example" });
    const member = t.withIdentity({ tokenIdentifier: memberId, subject: "member", issuer: "https://issuer.example" });
    const reviewer = t.withIdentity({ tokenIdentifier: reviewerId, subject: "reviewer", issuer: "https://issuer.example" });
    const outsider = t.withIdentity({ tokenIdentifier: outsiderId, subject: "outsider", issuer: "https://issuer.example" });

    const { organizationId } = await owner.mutation(createOrganization, { name: "Kivu Grid", slug: "kivu-grid" });
    const { startupProfileId } = await owner.mutation(createProfile, { organizationId, ...profile });

    await expect(outsider.query(listProfiles, { organizationId })).rejects.toThrow("Organization access denied");
    await expect(outsider.mutation(createCampaign, { organizationId, startupProfileId, name: "Seed research", dailyLimit: 10 })).rejects.toThrow("Organization access denied");

    await owner.mutation(addMember, { organizationId, userId: memberId, role: "member" });
    await owner.mutation(addMember, { organizationId, userId: reviewerId, role: "reviewer" });
    await owner.mutation(activateProfile, { startupProfileId });
    expect(await member.query(listProfiles, { organizationId })).toHaveLength(1);

    const { campaignId } = await member.mutation(createCampaign, { organizationId, startupProfileId, name: "Seed research", dailyLimit: 10 });
    await member.mutation(transitionCampaign, { campaignId, action: "request_review", expectedStatus: "draft" });
    await reviewer.mutation(transitionCampaign, { campaignId, action: "approve", expectedStatus: "review" });
    await expect(reviewer.mutation(transitionCampaign, { campaignId, action: "start", expectedStatus: "approved" })).rejects.toThrow("Organization access denied");
    await owner.mutation(transitionCampaign, { campaignId, action: "start", expectedStatus: "approved" });

    await expect(member.mutation(createWorkflow, { campaignId, kind: "investor_research", idempotencyKey: "seed-research/member/0001", budgetUsd: 5 })).rejects.toThrow("Organization access denied");
    const { runId } = await owner.mutation(createWorkflow, { campaignId, kind: "investor_research", idempotencyKey: "seed-research/owner/0001", budgetUsd: 5 });
    await expect(outsider.query(getWorkflow, { runId })).rejects.toThrow("Organization access denied");
    const persistedInput = await t.run(async (ctx) => {
      const step = await ctx.db.query("workflowSteps").withIndex("by_run", (query) => query.eq("runId", runId)).unique();
      return step?.input;
    });
    expect(persistedInput).toMatchObject({ profile: { name: "Kivu Grid", traction: profile.traction } });
  });
});
