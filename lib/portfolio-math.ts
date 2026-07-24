// Illustrative starting assumptions for planning only — editable in the UI,
// not a measurement of any specific fund's real performance.
export const DEFAULT_PACING_RATES = {
  reviewToMeetingRate: 0.3,
  meetingToInvestRate: 0.1,
  activeWeeksPerYear: 46,
} as const;

export type PacingAssumptions = {
  targetInvestmentsPerYear: number;
  meetingToInvestRate: number;
  reviewToMeetingRate: number;
  activeWeeksPerYear: number;
};

export type PacingResult = {
  meetingsNeeded: number;
  companiesToReviewNeeded: number;
  meetingsPerWeek: number;
  reviewsPerWeek: number;
};

const MIN_RATE = 0.0001;

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return MIN_RATE;
  return Math.min(Math.max(rate, MIN_RATE), 1);
}

// The investor-side numbers game run forward from a portfolio target: how
// many companies need to be reviewed and met to reach N investments a year,
// given the review→meeting and meeting→investment conversion rates.
export function computePortfolioPacing(input: PacingAssumptions): PacingResult {
  const targetInvestments = Math.max(0, Math.ceil(input.targetInvestmentsPerYear));
  const meetingToInvestRate = clampRate(input.meetingToInvestRate);
  const reviewToMeetingRate = clampRate(input.reviewToMeetingRate);
  const activeWeeksPerYear = Math.max(1, input.activeWeeksPerYear);

  const meetingsNeeded = Math.ceil(targetInvestments / meetingToInvestRate);
  const companiesToReviewNeeded = Math.ceil(meetingsNeeded / reviewToMeetingRate);

  return {
    meetingsNeeded,
    companiesToReviewNeeded,
    meetingsPerWeek: Math.ceil((meetingsNeeded / activeWeeksPerYear) * 10) / 10,
    reviewsPerWeek: Math.ceil((companiesToReviewNeeded / activeWeeksPerYear) * 10) / 10,
  };
}
