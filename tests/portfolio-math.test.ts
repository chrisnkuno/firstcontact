import { describe, expect, it } from "vitest";
import { computePortfolioPacing, DEFAULT_PACING_RATES } from "@/lib/portfolio-math";

describe("computePortfolioPacing", () => {
  it("chains a yearly investment target through meeting and review conversion rates", () => {
    const result = computePortfolioPacing({
      targetInvestmentsPerYear: 5,
      meetingToInvestRate: 0.2,
      reviewToMeetingRate: 0.5,
      activeWeeksPerYear: 50,
    });

    // 5 / 0.2 = 25 meetings
    expect(result.meetingsNeeded).toBe(25);
    // 25 / 0.5 = 50 companies to review
    expect(result.companiesToReviewNeeded).toBe(50);
    expect(result.meetingsPerWeek).toBeCloseTo(0.5, 5);
    expect(result.reviewsPerWeek).toBeCloseTo(1, 5);
  });

  it("never divides by zero when a conversion rate is 0", () => {
    const result = computePortfolioPacing({
      targetInvestmentsPerYear: 3,
      meetingToInvestRate: 0,
      reviewToMeetingRate: 0,
      activeWeeksPerYear: 48,
    });

    expect(Number.isFinite(result.companiesToReviewNeeded)).toBe(true);
    expect(result.companiesToReviewNeeded).toBeGreaterThan(0);
  });

  it("returns zero meetings needed for a zero investment target", () => {
    const result = computePortfolioPacing({
      targetInvestmentsPerYear: 0,
      ...DEFAULT_PACING_RATES,
    });

    expect(result.meetingsNeeded).toBe(0);
    expect(result.companiesToReviewNeeded).toBe(0);
  });
});
