import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./authz";

/**
 * Per-user onboarding progress.
 *
 * Stored as explicit step ids rather than a counter so that adding a card
 * later cannot silently un-complete anyone's checklist, and so a step can be
 * retired without rewriting stored rows. Completion is *derived* from the step
 * list for the user's role (see lib/onboarding.ts) rather than stored, which
 * keeps a single source of truth for what "done" means.
 */
export const myProgress = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const state = await ctx.db
      .query("onboardingState")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    return {
      completedSteps: state?.completedSteps ?? [],
      dismissedPanels: state?.dismissedPanels ?? [],
      completedAt: state?.completedAt ?? null,
    };
  },
});

export const completeStep = mutation({
  args: { stepId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const stepId = args.stepId.trim().slice(0, 64);
    if (!stepId) return { completedSteps: [] as string[] };

    const state = await ctx.db
      .query("onboardingState")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const now = Date.now();

    if (!state) {
      await ctx.db.insert("onboardingState", {
        userId: user._id,
        completedSteps: [stepId],
        dismissedPanels: [],
        updatedAt: now,
      });
      return { completedSteps: [stepId] };
    }

    if (state.completedSteps.includes(stepId)) return { completedSteps: state.completedSteps };
    const completedSteps = [...state.completedSteps, stepId];
    await ctx.db.patch(state._id, { completedSteps, updatedAt: now });
    return { completedSteps };
  },
});

export const dismissPanel = mutation({
  args: { panelId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const panelId = args.panelId.trim().slice(0, 64);
    if (!panelId) return { dismissedPanels: [] as string[] };

    const state = await ctx.db
      .query("onboardingState")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const now = Date.now();

    if (!state) {
      await ctx.db.insert("onboardingState", {
        userId: user._id,
        completedSteps: [],
        dismissedPanels: [panelId],
        updatedAt: now,
      });
      return { dismissedPanels: [panelId] };
    }

    if (state.dismissedPanels.includes(panelId)) return { dismissedPanels: state.dismissedPanels };
    const dismissedPanels = [...state.dismissedPanels, panelId];
    await ctx.db.patch(state._id, { dismissedPanels, updatedAt: now });
    return { dismissedPanels };
  },
});

/** Marks the whole checklist finished, which hides it from the dashboard. */
export const finish = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const state = await ctx.db
      .query("onboardingState")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const now = Date.now();

    if (!state) {
      await ctx.db.insert("onboardingState", {
        userId: user._id,
        completedSteps: [],
        dismissedPanels: [],
        completedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(state._id, { completedAt: now, updatedAt: now });
    }
    return { finished: true };
  },
});
