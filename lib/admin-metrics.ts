import {
  DAY_MS,
  WEEK_MS,
  bucketCounts,
  buildFunnel,
  growthPerPeriod,
  movingAverage,
  rate,
  recentBuckets,
  type FunnelStage,
} from "./metrics-core";
import type { AccountRole, InvestorType } from "./domain";

type SignupInput = {
  accountType: "startup" | "institution" | "individual";
  status: "new" | "reviewing" | "invited" | "active" | "declined";
  targetRegions: readonly ("US" | "UK" | "EU" | "APAC")[];
  goals: readonly string[];
  createdAt: number;
};

type UserInput = {
  role: AccountRole;
  investorType?: InvestorType;
  createdAt: number;
  lastSeenAt?: number;
  suspended: boolean;
};

type MessageInput = { status: string; createdAt: number };

type WorkflowRunInput = {
  status: "queued" | "running" | "succeeded" | "blocked" | "failed" | "cancelled";
  spentUsd: number;
  budgetUsd: number;
  createdAt: number;
};

export type AdminMetricsInput = {
  now: number;
  signups: readonly SignupInput[];
  users: readonly UserInput[];
  messages: readonly MessageInput[];
  workflowRuns: readonly WorkflowRunInput[];
  suppressionCount: number;
  catalogueInterestCount: number;
};

export type AdminMetrics = ReturnType<typeof buildAdminMetrics>;

const WEEKS_CHARTED = 12;
const ACTIVE_WINDOW_MS = 28 * DAY_MS;

/**
 * Every number the admin dashboard shows, derived in one pass from raw rows.
 *
 * Kept as a pure function over plain records — no database handle — so the
 * whole thing is unit-testable against fixed inputs, and so the Convex query
 * that feeds it stays a thin projection rather than a place where arithmetic
 * hides.
 */
export function buildAdminMetrics(input: AdminMetricsInput) {
  const { now, signups, users, messages, workflowRuns } = input;

  const byAccountType = { startup: 0, institution: 0, individual: 0 };
  const byStatus = { new: 0, reviewing: 0, invited: 0, active: 0, declined: 0 };
  const byRegion = { US: 0, UK: 0, EU: 0, APAC: 0 };
  const byGoal: Record<string, number> = {};
  let last7Days = 0;
  let last30Days = 0;

  for (const signup of signups) {
    byAccountType[signup.accountType] += 1;
    byStatus[signup.status] += 1;
    for (const region of signup.targetRegions) byRegion[region] += 1;
    for (const goal of signup.goals) byGoal[goal] = (byGoal[goal] ?? 0) + 1;
    if (now - signup.createdAt <= WEEK_MS) last7Days += 1;
    if (now - signup.createdAt <= 30 * DAY_MS) last30Days += 1;
  }

  const byRole = { participant: 0, investor: 0, admin: 0 };
  const byInvestorType: Record<string, number> = {};
  let activeUsers = 0;
  let suspendedUsers = 0;

  for (const user of users) {
    byRole[user.role] += 1;
    if (user.investorType) byInvestorType[user.investorType] = (byInvestorType[user.investorType] ?? 0) + 1;
    if (user.lastSeenAt !== undefined && now - user.lastSeenAt <= ACTIVE_WINDOW_MS) activeUsers += 1;
    if (user.suspended) suspendedUsers += 1;
  }

  /**
   * The intake funnel.
   *
   * `reviewing` is deliberately counted as "reached review or beyond" rather
   * than "currently in review" — a record that has already moved on to
   * `invited` did pass through review, and a funnel that treated the present
   * status as exclusive would show conversion collapsing as records advance.
   */
  const reachedReview = byStatus.reviewing + byStatus.invited + byStatus.active;
  const reachedInvite = byStatus.invited + byStatus.active;
  const funnel: FunnelStage[] = buildFunnel([
    { key: "signed_up", label: "Signed up", count: signups.length },
    { key: "reviewed", label: "Reviewed", count: reachedReview },
    { key: "invited", label: "Invited", count: reachedInvite },
    { key: "active", label: "Active", count: byStatus.active },
  ]);

  const buckets = recentBuckets(now, WEEKS_CHARTED, WEEK_MS);
  const signupSeries = bucketCounts(signups.map((s) => s.createdAt), buckets);
  const accountSeries = bucketCounts(users.map((u) => u.createdAt), buckets);

  const weeklySignups = buckets.map((bucket, index) => ({
    weekStart: bucket.start,
    label: bucket.label,
    signups: signupSeries[index],
    accounts: accountSeries[index],
    signupsTrend: Number(movingAverage(signupSeries, 4)[index].toFixed(2)),
  }));

  const sentMessages = messages.filter((m) => m.status === "sent").length;
  const failedMessages = messages.filter((m) => m.status === "failed").length;
  const suppressedMessages = messages.filter((m) => m.status === "suppressed").length;
  const awaitingApproval = messages.filter((m) => m.status === "draft").length;

  const succeededRuns = workflowRuns.filter((r) => r.status === "succeeded").length;
  const failedRuns = workflowRuns.filter((r) => r.status === "failed").length;
  const blockedRuns = workflowRuns.filter((r) => r.status === "blocked").length;
  const totalSpendUsd = workflowRuns.reduce((total, run) => total + run.spentUsd, 0);
  const totalBudgetUsd = workflowRuns.reduce((total, run) => total + run.budgetUsd, 0);

  return {
    generatedAt: now,

    signups: {
      total: signups.length,
      byAccountType,
      byStatus,
      byRegion,
      byGoal,
      last7Days,
      last30Days,
      weekOverWeekGrowth: growthPerPeriod(signupSeries),
    },

    accounts: {
      total: users.length,
      byRole,
      byInvestorType,
      activeLast28Days: activeUsers,
      suspended: suspendedUsers,
      // What share of people who registered interest went on to create an
      // account. The headline adoption number for the whole platform.
      activationRate: rate(users.length, signups.length),
      engagementRate: rate(activeUsers, users.length),
    },

    funnel,
    weeklySignups,

    outreach: {
      totalMessages: messages.length,
      sent: sentMessages,
      failed: failedMessages,
      suppressed: suppressedMessages,
      awaitingApproval,
      // Of everything actually attempted, how much left the building. Drafts
      // are excluded from the denominator: an unapproved draft is not a
      // delivery failure, it is work in progress.
      deliveryRate: rate(sentMessages, sentMessages + failedMessages),
      suppressionListSize: input.suppressionCount,
    },

    research: {
      totalRuns: workflowRuns.length,
      succeeded: succeededRuns,
      failed: failedRuns,
      blocked: blockedRuns,
      successRate: rate(succeededRuns, workflowRuns.length),
      totalSpendUsd: Number(totalSpendUsd.toFixed(2)),
      budgetUtilisation: rate(totalSpendUsd, totalBudgetUsd),
      averageSpendPerRunUsd:
        workflowRuns.length > 0 ? Number((totalSpendUsd / workflowRuns.length).toFixed(2)) : null,
    },

    catalogue: {
      interestSignals: input.catalogueInterestCount,
      signalsPerActiveSignup: rate(input.catalogueInterestCount, byStatus.active),
    },
  };
}
