import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireMembership } from "./authz";

const workflowKind = v.literal("investor_research");
const outputType = v.union(v.literal("research_plan"), v.literal("discovery"), v.literal("evidence"), v.literal("normalization"), v.literal("matching"), v.literal("draft"));

function requireWorkflowSecret(value: string) {
  const configured = process.env.WORKFLOW_ACTION_SECRET;
  if (!configured || value !== configured) throw new Error("Unauthorized workflow service");
}

async function releaseProviderReservations(ctx: MutationCtx, stepId: Id<"workflowSteps">, runId: Id<"workflowRuns">, now: number) {
  const operations = await ctx.db.query("providerOperations").withIndex("by_step_operation", (q) => q.eq("stepId", stepId)).collect();
  const reserved = operations.filter((operation) => operation.status === "reserved");
  if (reserved.length === 0) return;
  const run = await ctx.db.get(runId);
  if (!run) return;
  const refund = reserved.reduce((total, operation) => total + operation.reservedCostUsd, 0);
  for (const operation of reserved) await ctx.db.patch(operation._id, { status: "failed", actualCostUsd: 0, safeErrorCode: "lease_ended", updatedAt: now });
  await ctx.db.patch(run._id, { spentUsd: Math.max(0, run.spentUsd - refund), updatedAt: now });
}

export const createRun = mutation({
  args: {
    campaignId: v.id("campaigns"),
    kind: workflowKind,
    idempotencyKey: v.string(),
    budgetUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    const { identity } = await requireMembership(ctx, campaign.organizationId, ["owner"]);
    if (campaign.status !== "approved" && campaign.status !== "running") throw new Error("Campaign must be approved before work starts");
    if (args.budgetUsd <= 0 || args.budgetUsd > 500) throw new Error("Workflow budget is outside the allowed range");
    const profile = await ctx.db.get(campaign.startupProfileId);
    if (!profile || profile.organizationId !== campaign.organizationId || profile.status !== "active") throw new Error("Campaign profile is not active");
    const existing = await ctx.db.query("workflowRuns").withIndex("by_org_idempotency", (q) => q.eq("organizationId", campaign.organizationId).eq("idempotencyKey", args.idempotencyKey)).unique();
    if (existing) return { runId: existing._id, duplicate: true };

    const now = Date.now();
    const runId = await ctx.db.insert("workflowRuns", {
      organizationId: campaign.organizationId,
      campaignId: args.campaignId,
      kind: args.kind,
      status: "queued",
      requestedBy: identity.tokenIdentifier,
      idempotencyKey: args.idempotencyKey,
      budgetUsd: args.budgetUsd,
      spentUsd: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("workflowSteps", {
      runId,
      kind: args.kind,
      status: "pending",
      input: { profile: {
        name: profile.name,
        organizationType: profile.organizationType,
        website: profile.website,
        location: profile.location,
        region: profile.region,
        stage: profile.stage,
        sectors: profile.sectors,
        raiseAmountUsd: profile.raiseAmountUsd,
        oneLiner: profile.oneLiner,
        traction: profile.traction,
        impact: profile.impact,
        founderContext: profile.founderContext,
        targetRegions: profile.targetRegions,
        consentToProcess: true,
      } },
      attempt: 0,
      maxAttempts: 3,
      availableAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: campaign.organizationId,
      actorId: identity.tokenIdentifier,
      action: "workflow.requested",
      entityType: "workflowRun",
      entityId: runId,
      metadata: { kind: args.kind, budgetUsd: args.budgetUsd },
      createdAt: now,
    });
    return { runId, duplicate: false };
  },
});

export const getRun = query({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    await requireMembership(ctx, run.organizationId);
    const steps = await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", args.runId)).collect();
    const artifacts = await ctx.db.query("workflowArtifacts").withIndex("by_run", (q) => q.eq("runId", args.runId)).collect();
    return { run, steps, artifacts };
  },
});

export const claimNextStep = mutation({
  args: { workflowSecret: v.string(), leaseOwner: v.string(), leaseTokenHash: v.string(), now: v.number(), leaseMs: v.number() },
  handler: async (ctx, args) => {
    requireWorkflowSecret(args.workflowSecret);
    if (args.leaseMs < 10_000 || args.leaseMs > 15 * 60_000) throw new Error("Invalid lease duration");
    const step = await ctx.db.query("workflowSteps").withIndex("by_status_available", (q) => q.eq("status", "pending").lte("availableAt", args.now)).first();
    if (!step) return null;
    const run = await ctx.db.get(step.runId);
    if (!run || run.status === "cancelled") return null;
    const attempt = step.attempt + 1;
    await ctx.db.patch(step._id, {
      status: "leased",
      attempt,
      leaseOwner: args.leaseOwner,
      leaseTokenHash: args.leaseTokenHash,
      leaseExpiresAt: args.now + args.leaseMs,
      updatedAt: args.now,
    });
    await ctx.db.patch(run._id, { status: "running", updatedAt: args.now });
    return { stepId: step._id, runId: run._id, attempt, kind: step.kind, input: step.input, budgetUsd: run.budgetUsd, spentUsd: run.spentUsd };
  },
});

export const markRunning = mutation({
  args: { workflowSecret: v.string(), stepId: v.id("workflowSteps"), leaseTokenHash: v.string(), sandboxId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    requireWorkflowSecret(args.workflowSecret);
    const step = await ctx.db.get(args.stepId);
    if (!step || step.status !== "leased" || step.leaseTokenHash !== args.leaseTokenHash || (step.leaseExpiresAt ?? 0) <= args.now) throw new Error("Workflow lease is not active");
    await ctx.db.patch(step._id, { status: "running", sandboxId: args.sandboxId, updatedAt: args.now });
  },
});

export const completeStep = mutation({
  args: {
    workflowSecret: v.string(),
    stepId: v.id("workflowSteps"),
    leaseTokenHash: v.string(),
    attempt: v.number(),
    status: v.union(v.literal("succeeded"), v.literal("blocked"), v.literal("failed")),
    outputType,
    artifactSha256: v.string(),
    artifact: v.any(),
    sourceManifest: v.array(v.object({ url: v.string(), capturedAt: v.number(), contentSha256: v.string() })),
    usage: v.object({ durationMs: v.number(), providerCalls: v.number(), inputBytes: v.number(), outputBytes: v.number() }),
    templateVersion: v.string(),
    workerVersion: v.string(),
    blocker: v.optional(v.object({ code: v.string(), safeMessage: v.string(), retryable: v.boolean() })),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    requireWorkflowSecret(args.workflowSecret);
    const step = await ctx.db.get(args.stepId);
    if (!step) throw new Error("Workflow step not found");
    const duplicate = await ctx.db.query("workflowArtifacts").withIndex("by_step_digest", (q) => q.eq("stepId", step._id).eq("sha256", args.artifactSha256)).unique();
    if (duplicate) return { duplicate: true, artifactId: duplicate._id };
    if ((step.status !== "leased" && step.status !== "running") || step.leaseTokenHash !== args.leaseTokenHash || step.attempt !== args.attempt || (step.leaseExpiresAt ?? 0) <= args.now) throw new Error("Workflow result has no active matching lease");
    if (args.status !== "succeeded" && !args.blocker) throw new Error("Blocked and failed results require a blocker");

    const run = await ctx.db.get(step.runId);
    if (!run || run.status === "cancelled") throw new Error("Workflow run is not active");
    await releaseProviderReservations(ctx, step._id, run._id, args.now);
    const artifactId = await ctx.db.insert("workflowArtifacts", {
      organizationId: run.organizationId,
      runId: run._id,
      stepId: step._id,
      outputType: args.outputType,
      sha256: args.artifactSha256,
      payload: args.artifact,
      sourceManifest: args.sourceManifest,
      usage: args.usage,
      templateVersion: args.templateVersion,
      workerVersion: args.workerVersion,
      createdAt: args.now,
    });
    if (args.status === "succeeded" && args.outputType === "discovery" && args.artifact && typeof args.artifact === "object") {
      const artifact = args.artifact as { sources?: unknown; providerRequestIds?: unknown };
      const sources = Array.isArray(artifact.sources) ? artifact.sources.slice(0, 100) : [];
      const requestIds = Array.isArray(artifact.providerRequestIds) ? artifact.providerRequestIds : [];
      const providerRequestId = typeof requestIds[0] === "string" ? requestIds[0].slice(0, 200) : undefined;
      for (const value of sources) {
        if (!value || typeof value !== "object") continue;
        const source = value as { url?: unknown; title?: unknown; highlights?: unknown };
        if (typeof source.url !== "string" || source.url.length > 2_048) continue;
        let parsed: URL;
        try { parsed = new URL(source.url); } catch { continue; }
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
        const manifest = args.sourceManifest.find((item) => item.url === source.url);
        if (!manifest) continue;
        const title = typeof source.title === "string" ? source.title.slice(0, 500) : undefined;
        const highlights = Array.isArray(source.highlights) ? source.highlights.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
        const excerpt = highlights.join("\n").slice(0, 4_000) || undefined;
        const existingSource = await ctx.db.query("sources").withIndex("by_organization_url", (q) => q.eq("organizationId", run.organizationId).eq("url", source.url as string)).unique();
        const sourceId = existingSource?._id ?? await ctx.db.insert("sources", { organizationId: run.organizationId, url: source.url, title, provider: "exa", providerRequestId, capturedAt: manifest.capturedAt, excerpt, contentHash: manifest.contentSha256 });
        if (existingSource) await ctx.db.patch(existingSource._id, { title, providerRequestId, capturedAt: manifest.capturedAt, excerpt, contentHash: manifest.contentSha256 });
        const dedupeKey = `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}`.slice(0, 2_048);
        const existingCandidate = await ctx.db.query("researchCandidates").withIndex("by_organization_dedupe", (q) => q.eq("organizationId", run.organizationId).eq("dedupeKey", dedupeKey)).unique();
        if (existingCandidate) await ctx.db.patch(existingCandidate._id, { runId: run._id, sourceId, displayName: title ?? parsed.hostname, website: source.url, evidenceExcerpt: excerpt, updatedAt: args.now });
        else await ctx.db.insert("researchCandidates", { organizationId: run.organizationId, runId: run._id, sourceId, dedupeKey, displayName: title ?? parsed.hostname, website: source.url, evidenceExcerpt: excerpt, status: "unreviewed", createdAt: args.now, updatedAt: args.now });
      }
    }
    await ctx.db.patch(step._id, {
      status: args.status,
      outputDigest: args.artifactSha256,
      blockerCode: args.blocker?.code,
      safeMessage: args.blocker?.safeMessage,
      leaseTokenHash: undefined,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      updatedAt: args.now,
    });
    await ctx.db.patch(run._id, { status: args.status, updatedAt: args.now });
    await ctx.db.insert("auditEvents", {
      organizationId: run.organizationId,
      actorId: "fastapi-worker",
      action: `workflow.${args.status}`,
      entityType: "workflowRun",
      entityId: run._id,
      metadata: { stepId: step._id, outputType: args.outputType, blockerCode: args.blocker?.code },
      createdAt: args.now,
    });
    return { duplicate: false, artifactId };
  },
});

export const failAttempt = mutation({
  args: {
    workflowSecret: v.string(),
    stepId: v.id("workflowSteps"),
    leaseTokenHash: v.string(),
    attempt: v.number(),
    code: v.string(),
    safeMessage: v.string(),
    retryDelayMs: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    requireWorkflowSecret(args.workflowSecret);
    const step = await ctx.db.get(args.stepId);
    if (!step || (step.status !== "leased" && step.status !== "running") || step.leaseTokenHash !== args.leaseTokenHash || step.attempt !== args.attempt || (step.leaseExpiresAt ?? 0) <= args.now) throw new Error("Workflow failure has no active matching lease");
    const run = await ctx.db.get(step.runId);
    if (!run || run.status === "cancelled") throw new Error("Workflow run is not active");
    await releaseProviderReservations(ctx, step._id, run._id, args.now);
    const retrying = step.attempt < step.maxAttempts;
    await ctx.db.patch(step._id, {
      status: retrying ? "pending" : "failed",
      availableAt: retrying ? args.now + Math.max(1_000, Math.min(args.retryDelayMs, 15 * 60_000)) : step.availableAt,
      blockerCode: args.code,
      safeMessage: args.safeMessage,
      leaseTokenHash: undefined,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      sandboxId: undefined,
      updatedAt: args.now,
    });
    await ctx.db.patch(run._id, { status: retrying ? "queued" : "failed", updatedAt: args.now });
    await ctx.db.insert("auditEvents", {
      organizationId: run.organizationId,
      actorId: "fastapi-worker",
      action: retrying ? "workflow.retry_scheduled" : "workflow.failed",
      entityType: "workflowRun",
      entityId: run._id,
      metadata: { stepId: step._id, attempt: step.attempt, code: args.code },
      createdAt: args.now,
    });
    return { retrying, nextAttempt: retrying ? step.attempt + 1 : null };
  },
});

export const requeueExpiredLeases = mutation({
  args: { workflowSecret: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    requireWorkflowSecret(args.workflowSecret);
    const leased = await ctx.db.query("workflowSteps").withIndex("by_status_lease", (q) => q.eq("status", "leased").lte("leaseExpiresAt", args.now)).take(25);
    const running = await ctx.db.query("workflowSteps").withIndex("by_status_lease", (q) => q.eq("status", "running").lte("leaseExpiresAt", args.now)).take(25);
    let requeued = 0;
    let failed = 0;
    const orphanSandboxIds: string[] = [];
    for (const step of [...leased, ...running]) {
      const run = await ctx.db.get(step.runId);
      if (!run || run.status === "cancelled") continue;
      const retrying = step.attempt < step.maxAttempts;
      if (step.sandboxId) orphanSandboxIds.push(step.sandboxId);
      await releaseProviderReservations(ctx, step._id, run._id, args.now);
      await ctx.db.patch(step._id, {
        status: retrying ? "pending" : "failed",
        availableAt: args.now,
        blockerCode: "lease_expired",
        safeMessage: "The worker lease expired before a valid result was committed.",
        leaseTokenHash: undefined,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        sandboxId: undefined,
        updatedAt: args.now,
      });
      await ctx.db.patch(run._id, { status: retrying ? "queued" : "failed", updatedAt: args.now });
      if (retrying) requeued += 1;
      else failed += 1;
    }
    return { requeued, failed, orphanSandboxIds };
  },
});

export const cancelRun = mutation({
  args: { runId: v.id("workflowRuns"), now: v.number() },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Workflow run not found");
    const { identity } = await requireMembership(ctx, run.organizationId, ["owner"]);
    if (run.status === "succeeded" || run.status === "failed" || run.status === "blocked") throw new Error("Terminal workflow cannot be cancelled");
    const steps = await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", run._id)).collect();
    const sandboxIds = steps.flatMap((step) => step.sandboxId ? [step.sandboxId] : []);
    for (const step of steps) {
      if (step.status !== "succeeded" && step.status !== "failed" && step.status !== "blocked") {
        await releaseProviderReservations(ctx, step._id, run._id, args.now);
        await ctx.db.patch(step._id, { status: "cancelled", leaseTokenHash: undefined, leaseExpiresAt: undefined, updatedAt: args.now });
      }
    }
    await ctx.db.patch(run._id, { status: "cancelled", updatedAt: args.now });
    await ctx.db.insert("auditEvents", { organizationId: run.organizationId, actorId: identity.tokenIdentifier, action: "workflow.cancelled", entityType: "workflowRun", entityId: run._id, createdAt: args.now });
    return { sandboxIds };
  },
});

export const reserveProviderOperation = mutation({
  args: {
    workflowSecret: v.string(), stepId: v.id("workflowSteps"), leaseTokenHash: v.string(),
    operationKey: v.string(), requestDigest: v.string(), reservedCostUsd: v.number(), now: v.number(),
  },
  handler: async (ctx, args) => {
    requireWorkflowSecret(args.workflowSecret);
    const step = await ctx.db.get(args.stepId);
    if (!step || (step.status !== "leased" && step.status !== "running") || step.leaseTokenHash !== args.leaseTokenHash || (step.leaseExpiresAt ?? 0) <= args.now) throw new Error("Provider operation has no active matching lease");
    const run = await ctx.db.get(step.runId);
    if (!run || run.status === "cancelled") throw new Error("Workflow run is not active");
    if (args.reservedCostUsd <= 0 || args.reservedCostUsd > 1) throw new Error("Invalid provider reservation");
    const existing = await ctx.db.query("providerOperations").withIndex("by_step_operation", (q) => q.eq("stepId", step._id).eq("operationKey", args.operationKey)).unique();
    if (existing) {
      if (existing.requestDigest !== args.requestDigest) throw new Error("Provider idempotency collision");
      return { operationId: existing._id, duplicate: true, status: existing.status, response: existing.response };
    }
    if (run.spentUsd + args.reservedCostUsd > run.budgetUsd) throw new Error("Workflow provider budget exhausted");
    const operationId = await ctx.db.insert("providerOperations", {
      organizationId: run.organizationId, runId: run._id, stepId: step._id, provider: "exa",
      operationKey: args.operationKey, requestDigest: args.requestDigest, status: "reserved",
      reservedCostUsd: args.reservedCostUsd, createdAt: args.now, updatedAt: args.now,
    });
    await ctx.db.patch(run._id, { spentUsd: run.spentUsd + args.reservedCostUsd, updatedAt: args.now });
    return { operationId, duplicate: false, status: "reserved" };
  },
});

export const finalizeProviderOperation = mutation({
  args: {
    workflowSecret: v.string(), operationId: v.id("providerOperations"), leaseTokenHash: v.string(),
    status: v.union(v.literal("succeeded"), v.literal("failed")), actualCostUsd: v.number(),
    providerRequestId: v.optional(v.string()), response: v.optional(v.any()), safeErrorCode: v.optional(v.string()), now: v.number(),
  },
  handler: async (ctx, args) => {
    requireWorkflowSecret(args.workflowSecret);
    const operation = await ctx.db.get(args.operationId);
    if (!operation) throw new Error("Provider operation not found");
    if (operation.status !== "reserved") return { duplicate: true };
    const step = await ctx.db.get(operation.stepId);
    if (!step || step.leaseTokenHash !== args.leaseTokenHash || (step.leaseExpiresAt ?? 0) <= args.now) throw new Error("Provider operation lease expired");
    const run = await ctx.db.get(operation.runId);
    if (!run) throw new Error("Workflow run not found");
    if (args.actualCostUsd < 0 || args.actualCostUsd > operation.reservedCostUsd) throw new Error("Provider cost exceeds its reservation");
    await ctx.db.patch(operation._id, { status: args.status, actualCostUsd: args.actualCostUsd, providerRequestId: args.providerRequestId, response: args.response, safeErrorCode: args.safeErrorCode, updatedAt: args.now });
    await ctx.db.patch(run._id, { spentUsd: Math.max(0, run.spentUsd - operation.reservedCostUsd + args.actualCostUsd), updatedAt: args.now });
    return { duplicate: false };
  },
});
