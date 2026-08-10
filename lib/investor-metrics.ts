import { computePortfolioPacing, type PacingResult } from "./portfolio-math";
import { WEEK_MS, bucketCounts, buildFunnel, rate, recentBuckets } from "./metrics-core";
import type { InvestorType } from "./domain";

/**
 * Investor-side metrics, parameterised by investor type.
 *
 * The types genuinely measure different things, and flattening them into one
 * "investor dashboard" would make most of it irrelevant to most users:
 *
 *   - an angel is deploying personal capital and cares about pace and cheque
 *     discipline;
 *   - a venture fund cares about fund construction — ownership, reserves, and
 *     whether the deployment period is on schedule;
 *   - a development-finance institution is mandate-bound, so coverage against
 *     target geographies and sectors is the point;
 *   - a limited partner does not do direct deals at all and tracks
 *     commitments and capital calls instead.
 *
 * So the defaults below differ per type, and `buildInvestorMetrics` emits a
 * `focus` discriminator the dashboard uses to decide which panels to render.
 */

export type InvestorFocus = "deployment" | "fund-construction" | "mandate" | "commitments";

export type InvestorTypeDefaults = {
  focus: InvestorFocus;
  targetInvestmentsPerYear: number;
  avgCheckUsd: number;
  reviewToMeetingRate: number;
  meetingToInvestRate: number;
  /** Share of a fund held back for follow-on rather than first cheques. */
  reserveRatio: number;
  activeWeeksPerYear: number;
};

/**
 * Planning defaults per investor type.
 *
 * These are starting assumptions for planning, not measurements of any real
 * fund's performance, and every one of them is editable in the UI. They are
 * ordered so that cheque size rises and deal count falls as you move from
 * angels to institutions, which is the shape the ranges actually take.
 */
export const INVESTOR_TYPE_DEFAULTS: Record<InvestorType, InvestorTypeDefaults> = {
  angel: {
    focus: "deployment",
    targetInvestmentsPerYear: 6,
    avgCheckUsd: 25_000,
    reviewToMeetingRate: 0.25,
    meetingToInvestRate: 0.1,
    reserveRatio: 0.2,
    activeWeeksPerYear: 46,
  },
  syndicate: {
    focus: "deployment",
    targetInvestmentsPerYear: 12,
    avgCheckUsd: 150_000,
    reviewToMeetingRate: 0.2,
    meetingToInvestRate: 0.12,
    reserveRatio: 0.15,
    activeWeeksPerYear: 46,
  },
  venture: {
    focus: "fund-construction",
    targetInvestmentsPerYear: 10,
    avgCheckUsd: 1_500_000,
    reviewToMeetingRate: 0.15,
    meetingToInvestRate: 0.05,
    reserveRatio: 0.5,
    activeWeeksPerYear: 46,
  },
  corporate: {
    focus: "fund-construction",
    targetInvestmentsPerYear: 5,
    avgCheckUsd: 2_000_000,
    reviewToMeetingRate: 0.12,
    meetingToInvestRate: 0.06,
    reserveRatio: 0.4,
    activeWeeksPerYear: 44,
  },
  "family-office": {
    focus: "deployment",
    targetInvestmentsPerYear: 8,
    avgCheckUsd: 750_000,
    reviewToMeetingRate: 0.2,
    meetingToInvestRate: 0.08,
    reserveRatio: 0.3,
    activeWeeksPerYear: 44,
  },
  "development-finance": {
    focus: "mandate",
    targetInvestmentsPerYear: 12,
    avgCheckUsd: 5_000_000,
    reviewToMeetingRate: 0.3,
    meetingToInvestRate: 0.15,
    reserveRatio: 0.25,
    activeWeeksPerYear: 44,
  },
  "limited-partner": {
    focus: "commitments",
    targetInvestmentsPerYear: 4,
    avgCheckUsd: 10_000_000,
    reviewToMeetingRate: 0.35,
    meetingToInvestRate: 0.2,
    reserveRatio: 0.0,
    activeWeeksPerYear: 46,
  },
  accelerator: {
    focus: "deployment",
    targetInvestmentsPerYear: 40,
    avgCheckUsd: 50_000,
    reviewToMeetingRate: 0.15,
    meetingToInvestRate: 0.2,
    reserveRatio: 0.35,
    activeWeeksPerYear: 40,
  },
};

export type InvestorActivity = {
  reviewedAt: readonly number[];
  metAt: readonly number[];
  investedAt: readonly number[];
  deployedUsd: number;
};

export type PortfolioAllocation = {
  /** Allocation weights keyed by sector, region or stage. Any positive scale. */
  bySector: Readonly<Record<string, number>>;
  byRegion: Readonly<Record<string, number>>;
  byStage: Readonly<Record<string, number>>;
};

/**
 * Concentration on a 0–1 scale, from the Herfindahl–Hirschman index.
 *
 * Raw HHI is not comparable across portfolios of different sizes — a
 * perfectly even 3-holding portfolio scores 0.33 while an even 20-holding one
 * scores 0.05, which would read as though the first were badly concentrated.
 * This normalises against the even-split floor (1/n) so that 0 always means
 * "as diversified as this many holdings allows" and 1 means "everything in
 * one bucket", regardless of n.
 */
export function concentration(weights: Readonly<Record<string, number>>): number | null {
  const values = Object.values(weights).filter((value) => value > 0);
  if (values.length === 0) return null;
  if (values.length === 1) return 1;

  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  const hhi = values.reduce((sum, value) => sum + (value / total) ** 2, 0);
  const floor = 1 / values.length;
  return (hhi - floor) / (1 - floor);
}

export type InvestorMetricsInput = {
  now: number;
  investorType: InvestorType;
  /** Total capital available to deploy over the period. */
  fundSizeUsd: number;
  /** Length of the deployment period in years. */
  deploymentYears: number;
  overrides?: Partial<InvestorTypeDefaults>;
  activity: InvestorActivity;
  allocation: PortfolioAllocation;
};

const WEEKS_CHARTED = 12;

export function buildInvestorMetrics(input: InvestorMetricsInput) {
  const defaults = { ...INVESTOR_TYPE_DEFAULTS[input.investorType], ...input.overrides };

  const pacing: PacingResult = computePortfolioPacing({
    targetInvestmentsPerYear: defaults.targetInvestmentsPerYear,
    meetingToInvestRate: defaults.meetingToInvestRate,
    reviewToMeetingRate: defaults.reviewToMeetingRate,
    activeWeeksPerYear: defaults.activeWeeksPerYear,
  });

  const reviewed = input.activity.reviewedAt.length;
  const met = input.activity.metAt.length;
  const invested = input.activity.investedAt.length;

  const actualFunnel = buildFunnel([
    { key: "reviewed", label: "Reviewed", count: reviewed },
    { key: "met", label: "Met", count: met },
    { key: "invested", label: "Invested", count: invested },
  ]);

  const buckets = recentBuckets(input.now, WEEKS_CHARTED, WEEK_MS);
  const reviewSeries = bucketCounts(input.activity.reviewedAt, buckets);
  const meetingSeries = bucketCounts(input.activity.metAt, buckets);
  const investSeries = bucketCounts(input.activity.investedAt, buckets);

  const weekly = buckets.map((bucket, index) => ({
    weekStart: bucket.start,
    label: bucket.label,
    reviewed: reviewSeries[index],
    met: meetingSeries[index],
    invested: investSeries[index],
    plannedReviews: pacing.reviewsPerWeek,
  }));

  // Fund construction: what is available for first cheques after reserves, and
  // how many of them that implies at the assumed cheque size.
  const reserveUsd = input.fundSizeUsd * defaults.reserveRatio;
  const initialCapitalUsd = Math.max(0, input.fundSizeUsd - reserveUsd);
  const impliedInitialPositions =
    defaults.avgCheckUsd > 0 ? Math.floor(initialCapitalUsd / defaults.avgCheckUsd) : 0;

  const years = Math.max(input.deploymentYears, 1 / 12);
  const targetDeploymentPerYearUsd = input.fundSizeUsd / years;
  const deployedUsd = input.activity.deployedUsd;

  return {
    investorType: input.investorType,
    focus: defaults.focus,
    defaults,
    pacing,
    actualFunnel,
    weekly,

    deployment: {
      deployedUsd,
      remainingUsd: Math.max(0, input.fundSizeUsd - deployedUsd),
      deployedShare: rate(deployedUsd, input.fundSizeUsd),
      targetDeploymentPerYearUsd: Math.round(targetDeploymentPerYearUsd),
      averageCheckUsd: invested > 0 ? Math.round(deployedUsd / invested) : null,
      positionsMade: invested,
    },

    construction: {
      reserveUsd: Math.round(reserveUsd),
      initialCapitalUsd: Math.round(initialCapitalUsd),
      impliedInitialPositions,
      reserveRatio: defaults.reserveRatio,
      // How far through the intended number of positions this portfolio is.
      buildOutProgress: rate(invested, impliedInitialPositions),
    },

    diversification: {
      sectorConcentration: concentration(input.allocation.bySector),
      regionConcentration: concentration(input.allocation.byRegion),
      stageConcentration: concentration(input.allocation.byStage),
      sectorCount: Object.keys(input.allocation.bySector).length,
      regionCount: Object.keys(input.allocation.byRegion).length,
    },

    calibration: {
      observedMeetingRate: rate(met, reviewed),
      assumedMeetingRate: defaults.reviewToMeetingRate,
      observedInvestRate: rate(invested, met),
      assumedInvestRate: defaults.meetingToInvestRate,
      hasEnoughData: reviewed >= 20,
    },
  };
}
