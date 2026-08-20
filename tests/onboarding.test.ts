import { describe, expect, it } from "vitest";
import { onboardingStepsFor, resolveOnboarding, type OnboardingSignals } from "../lib/onboarding";

const NOTHING: OnboardingSignals = {
  hasProfile: false,
  hasIntakeRecord: false,
  hasOrganization: false,
  hasCampaign: false,
  hasMfa: false,
  hasInvestorType: false,
  expressedInterest: false,
  hasListing: false,
  listingPublished: false,
};

/**
 * Onboarding is the first thing a new account sees on either side, so two
 * properties are worth pinning: every action it offers must point at a route
 * that exists, and a derived step must describe the account as it is now.
 */
describe("onboarding", () => {
  // The checklist previously linked participants to /dashboard/profile and
  // investors to /investor/profile, neither of which existed — the first thing
  // the product asked a new account to do was follow a dead link.
  it("only ever links to routes the app actually builds", () => {
    const built = new Set([
      "/dashboard",
      "/dashboard/profile",
      "/dashboard/organization",
      "/investor",
      "/investor/profile",
      "/admin",
      "/admin/mfa",
      "/admin/pipeline",
      "/admin/listings",
      "/catalogue",
      "/plan",
      "/pacing",
      "/responsible-outreach",
    ]);

    for (const role of ["participant", "investor", "admin"] as const) {
      for (const step of onboardingStepsFor(role)) {
        if (step.action) expect(built).toContain(step.action.href);
      }
    }
  });

  it("starts a brand-new participant with nothing ticked", () => {
    const { completedCount, allDone } = resolveOnboarding("participant", NOTHING, []);
    expect(completedCount).toBe(0);
    expect(allDone).toBe(false);
  });

  it("ticks the listing step only once the listing is actually published", () => {
    const drafted = resolveOnboarding("participant", { ...NOTHING, hasListing: true }, []);
    expect(drafted.steps.find((step) => step.id === "participant.listing")?.done).toBe(false);

    const published = resolveOnboarding(
      "participant",
      { ...NOTHING, hasListing: true, listingPublished: true },
      [],
    );
    expect(published.steps.find((step) => step.id === "participant.listing")?.done).toBe(true);
  });

  // A derived step must ignore the stored acknowledgement list entirely, so
  // that withdrawing a listing un-ticks the step rather than leaving the
  // checklist claiming something that is no longer true.
  it("un-ticks a derived step when the underlying state goes away", () => {
    const acknowledged = ["participant.listing", "participant.organization"];
    const resolved = resolveOnboarding("participant", NOTHING, acknowledged);
    expect(resolved.steps.find((step) => step.id === "participant.listing")?.done).toBe(false);
    expect(resolved.steps.find((step) => step.id === "participant.organization")?.done).toBe(false);
  });

  it("still honours acknowledgement for steps that cannot be observed", () => {
    const resolved = resolveOnboarding("participant", NOTHING, ["participant.plan"]);
    expect(resolved.steps.find((step) => step.id === "participant.plan")?.done).toBe(true);
  });
});
