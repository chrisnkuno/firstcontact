import { describe, expect, it } from "vitest";
import { campaignCreateSchema, startupProfileSchema, workerResultEnvelopeSchema, workflowRunRequestSchema } from "@/lib/domain";
import { campaignStatusAfter, canPerformCampaignAction } from "@/lib/control-plane";

const profile = startupProfileSchema.parse({
  name: "Kivu Grid",
  organizationType: "startup",
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
});

describe("workflow contracts", () => {
  it("accepts a bounded, idempotent research request", () => {
    expect(workflowRunRequestSchema.parse({ campaignId: "campaign-1", kind: "investor_research", idempotencyKey: "workflow/campaign-1/001", budgetUsd: 5 }).kind).toBe("investor_research");
    expect(workflowRunRequestSchema.safeParse({ campaignId: "campaign-1", kind: "investor_research", idempotencyKey: "workflow/campaign-1/001", budgetUsd: 5, profile }).success).toBe(false);
  });

  it("bounds campaign creation and keeps owner-only execution transitions", () => {
    expect(campaignCreateSchema.parse({ organizationId: "org-1", startupProfileId: "profile-1", name: "Seed research", dailyLimit: 10 }).dailyLimit).toBe(10);
    expect(campaignCreateSchema.safeParse({ organizationId: "org-1", startupProfileId: "profile-1", name: "Seed research", dailyLimit: 26 }).success).toBe(false);
    expect(canPerformCampaignAction("member", "draft", "request_review")).toBe(true);
    expect(canPerformCampaignAction("reviewer", "review", "approve")).toBe(true);
    expect(canPerformCampaignAction("reviewer", "approved", "start")).toBe(false);
    expect(campaignStatusAfter("pause")).toBe("paused");
  });

  it("requires safe blocker details for a failed worker result", () => {
    const result = workerResultEnvelopeSchema.safeParse({
      runId: "run-1",
      stepId: "step-1",
      attempt: 1,
      templateVersion: "firstcontact-python-v1",
      workerVersion: "0.1.0",
      status: "failed",
      outputType: "research_plan",
      artifactSha256: "a".repeat(64),
      artifact: {},
      sourceManifest: [],
      usage: { durationMs: 12, providerCalls: 0, inputBytes: 10, outputBytes: 10 },
    });
    expect(result.success).toBe(false);
  });

  it("does not allow successful results to smuggle a blocker", () => {
    const result = workerResultEnvelopeSchema.safeParse({
      runId: "run-1",
      stepId: "step-1",
      attempt: 1,
      templateVersion: "firstcontact-python-v1",
      workerVersion: "0.1.0",
      status: "succeeded",
      outputType: "research_plan",
      artifactSha256: "b".repeat(64),
      artifact: { queries: [] },
      sourceManifest: [],
      usage: { durationMs: 12, providerCalls: 0, inputBytes: 10, outputBytes: 10 },
      blocker: { code: "unexpected", safeMessage: "This must not be accepted", retryable: false },
    });
    expect(result.success).toBe(false);
  });
});
