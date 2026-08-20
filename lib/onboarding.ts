import type { AccountRole } from "./domain";

/**
 * Onboarding content, as data.
 *
 * Steps are declared here rather than embedded in components so that
 * completion can be *derived* — a step whose `isDone` predicate is satisfied by
 * real account state ticks itself, and only the steps that genuinely cannot be
 * observed (reading a page, making a decision) rely on the user marking them.
 *
 * That distinction is the difference between a checklist that reflects reality
 * and one that is a to-do list the product cannot verify.
 */

export type OnboardingSignals = {
  hasProfile: boolean;
  hasIntakeRecord: boolean;
  hasOrganization: boolean;
  hasCampaign: boolean;
  hasMfa: boolean;
  hasInvestorType: boolean;
  expressedInterest: boolean;
  /** A startup profile exists and a catalogue listing has been drafted from it. */
  hasListing: boolean;
  /** That listing has been through review and is visible to investors. */
  listingPublished: boolean;
};

export type OnboardingStep = {
  id: string;
  title: string;
  body: string;
  action?: { label: string; href: string };
  /**
   * Derives completion from account state. Steps without one are
   * acknowledgement-only and completed by the user pressing "Done".
   */
  isDone?: (signals: OnboardingSignals) => boolean;
};

const PARTICIPANT_STEPS: OnboardingStep[] = [
  {
    id: "participant.profile",
    title: "Complete your profile",
    body: "Your name, organization and location identify you across the platform. Your email is your login.",
    action: { label: "Edit profile", href: "/dashboard/profile" },
    isDone: (signals) => signals.hasProfile,
  },
  {
    id: "participant.intake",
    title: "Link your intake record",
    body: "If you submitted an interest form before creating this account, we match it by email so your review status shows here.",
    isDone: (signals) => signals.hasIntakeRecord,
  },
  {
    id: "participant.organization",
    title: "Create your organization",
    body: "Listings, campaigns, sources and approvals all belong to an organization, so colleagues can review work you did not write.",
    action: { label: "Open your workspace", href: "/dashboard/organization" },
    isDone: (signals) => signals.hasOrganization,
  },
  {
    id: "participant.listing",
    title: "Write and publish your listing",
    body: "The public half of your profile: the operating context, strengths and open questions you choose to show investors. You decide every word, and you can take it down at any time.",
    action: { label: "Edit your listing", href: "/dashboard/organization" },
    isDone: (signals) => signals.listingPublished,
  },
  {
    id: "participant.plan",
    title: "Set your raise plan",
    body: "Work backwards from your target: how many investor conversations does this raise actually need, at your stage's typical cheque size?",
    action: { label: "Open the planner", href: "/plan" },
  },
  {
    id: "participant.review",
    title: "Understand the approval boundary",
    body: "Research and drafting are automated. Sending is not. No message reaches an investor until a person on your side approves that specific message.",
    action: { label: "Read the outreach policy", href: "/responsible-outreach" },
  },
];

const INVESTOR_STEPS: OnboardingStep[] = [
  {
    id: "investor.type",
    title: "Confirm your investor type",
    body: "An angel, a fund and a development-finance institution track different numbers. Your type decides which metrics your dashboard leads with.",
    action: { label: "Edit profile", href: "/investor/profile" },
    isDone: (signals) => signals.hasInvestorType,
  },
  {
    id: "investor.pacing",
    title: "Set your deployment pace",
    body: "How many investments a year, at what cheque size, over what period. Everything else on your dashboard is measured against this.",
    action: { label: "Open pacing", href: "/pacing" },
  },
  {
    id: "investor.catalogue",
    title: "Browse the catalogue",
    body: "Every listing is published by the founder, with the fields they approved for publication — not scraped, and not shared without consent.",
    action: { label: "Open the catalogue", href: "/catalogue" },
    isDone: (signals) => signals.expressedInterest,
  },
  {
    id: "investor.signal",
    title: "Express interest deliberately",
    body: "Interest is a signal to the founder, not an introduction. They decide whether to share more, and nothing is disclosed until they do.",
  },
];

const ADMIN_STEPS: OnboardingStep[] = [
  {
    id: "admin.mfa",
    title: "Enrol an authenticator",
    body: "Multi-factor authentication is mandatory for operator accounts. Until you enrol, every privileged read and write is refused.",
    action: { label: "Set up MFA", href: "/admin/mfa" },
    isDone: (signals) => signals.hasMfa,
  },
  {
    id: "admin.pipeline",
    title: "Review the intake pipeline",
    body: "New signups arrive as `new`. Moving a record through review, invite and active is recorded in the audit log against your account.",
    action: { label: "Open pipeline", href: "/admin/pipeline" },
  },
  {
    id: "admin.policy",
    title: "Check outbound gates before enabling delivery",
    body: "Outbound stays disabled until suppression handling, sender identity, unsubscribe and jurisdiction review are all configured.",
    action: { label: "Read the compliance checklist", href: "/responsible-outreach" },
  },
];

export function onboardingStepsFor(role: AccountRole): OnboardingStep[] {
  if (role === "investor") return INVESTOR_STEPS;
  if (role === "admin") return ADMIN_STEPS;
  return PARTICIPANT_STEPS;
}

export type ResolvedStep = OnboardingStep & { done: boolean; derived: boolean };

/**
 * Merges declared steps with observed state and stored acknowledgements.
 *
 * A derived step ignores the stored list entirely — if the underlying condition
 * stops holding (an organization is deleted, MFA is reset), the step un-ticks,
 * because the checklist is meant to describe the account as it is now.
 */
export function resolveOnboarding(
  role: AccountRole,
  signals: OnboardingSignals,
  completedSteps: readonly string[],
): { steps: ResolvedStep[]; completedCount: number; total: number; allDone: boolean } {
  const steps = onboardingStepsFor(role).map((step) => ({
    ...step,
    derived: step.isDone !== undefined,
    done: step.isDone ? step.isDone(signals) : completedSteps.includes(step.id),
  }));

  const completedCount = steps.filter((step) => step.done).length;
  return { steps, completedCount, total: steps.length, allDone: completedCount === steps.length };
}
