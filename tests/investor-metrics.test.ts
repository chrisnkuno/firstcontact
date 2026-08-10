import { describe, expect, it } from "vitest";
import {
  INVESTOR_TYPE_DEFAULTS,
  buildInvestorMetrics,
  concentration,
} from "@/lib/investor-metrics";
import { investorTypes } from "@/lib/domain";

const emptyActivity = { reviewedAt: [], metAt: [], investedAt: [], deployedUsd: 0 };
const emptyAllocation = { bySector: {}, byRegion: {}, byStage: {} };

describe("concentration", () => {
  // Raw HHI is not comparable across portfolios of different sizes, so the
  // normalised form must read 0 for any evenly-split portfolio regardless of
  // how many holdings it has.
  it("reports an evenly split portfolio as zero concentration at any size", () => {
    expect(concentration({ a: 1, b: 1, c: 1 })).toBeCloseTo(0, 10);
    expect(concentration({ a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 })).toBeCloseTo(0, 10);
  });

  it("reports a single holding as fully concentrated", () => {
    expect(concentration({ a: 7 })).toBe(1);
  });

  it("ranks a skewed portfolio between the two extremes", () => {
    const skewed = concentration({ a: 90, b: 5, c: 5 });
    expect(skewed).not.toBeNull();
    expect(skewed!).toBeGreaterThan(0);
    expect(skewed!).toBeLessThan(1);
  });

  it("returns null for an empty portfolio rather than zero", () => {
    expect(concentration({})).toBeNull();
    expect(concentration({ a: 0 })).toBeNull();
  });
});

describe("buildInvestorMetrics", () => {
  it("gives every investor type a defined focus and pacing", () => {
    for (const type of investorTypes) {
      const metrics = buildInvestorMetrics({
        now: Date.now(),
        investorType: type,
        fundSizeUsd: 10_000_000,
        deploymentYears: 3,
        activity: emptyActivity,
        allocation: emptyAllocation,
      });

      expect(metrics.focus).toBe(INVESTOR_TYPE_DEFAULTS[type].focus);
      // Reaching N investments always requires at least N meetings and at
      // least that many reviews — the funnel can never invert.
      expect(metrics.pacing.meetingsNeeded).toBeGreaterThanOrEqual(
        INVESTOR_TYPE_DEFAULTS[type].targetInvestmentsPerYear,
      );
      expect(metrics.pacing.companiesToReviewNeeded).toBeGreaterThanOrEqual(
        metrics.pacing.meetingsNeeded,
      );
    }
  });

  it("splits a fund into reserves and initial capital that sum to the whole", () => {
    const metrics = buildInvestorMetrics({
      now: Date.now(),
      investorType: "venture",
      fundSizeUsd: 100_000_000,
      deploymentYears: 4,
      activity: emptyActivity,
      allocation: emptyAllocation,
    });

    expect(metrics.construction.reserveUsd + metrics.construction.initialCapitalUsd).toBe(
      100_000_000,
    );
    expect(metrics.construction.impliedInitialPositions).toBeGreaterThan(0);
  });

  it("reports no observed conversion until there is something to divide by", () => {
    const metrics = buildInvestorMetrics({
      now: Date.now(),
      investorType: "angel",
      fundSizeUsd: 500_000,
      deploymentYears: 2,
      activity: emptyActivity,
      allocation: emptyAllocation,
    });

    expect(metrics.calibration.observedMeetingRate).toBeNull();
    expect(metrics.calibration.hasEnoughData).toBe(false);
    expect(metrics.deployment.averageCheckUsd).toBeNull();
  });

  it("measures real conversion once enough activity exists", () => {
    const now = Date.parse("2026-08-09T12:00:00Z");
    const reviewedAt = Array.from({ length: 40 }, (_, index) => now - index * 60_000);
    const metAt = reviewedAt.slice(0, 10);

    const metrics = buildInvestorMetrics({
      now,
      investorType: "angel",
      fundSizeUsd: 500_000,
      deploymentYears: 2,
      activity: { reviewedAt, metAt, investedAt: [], deployedUsd: 0 },
      allocation: emptyAllocation,
    });

    expect(metrics.calibration.observedMeetingRate).toBeCloseTo(0.25, 10);
    expect(metrics.calibration.hasEnoughData).toBe(true);
  });

  it("never divides by a zero deployment period", () => {
    const metrics = buildInvestorMetrics({
      now: Date.now(),
      investorType: "syndicate",
      fundSizeUsd: 1_000_000,
      deploymentYears: 0,
      activity: emptyActivity,
      allocation: emptyAllocation,
    });
    expect(Number.isFinite(metrics.deployment.targetDeploymentPerYearUsd)).toBe(true);
  });
});
