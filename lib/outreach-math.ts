import { stages } from "./domain";

export type Stage = (typeof stages)[number];

// Illustrative starting assumptions for planning only — not a measurement of
// FirstContact's own delivery performance. Every rate here is user-editable
// in the UI; these are just defensible cold-outreach planning defaults.
export const STAGE_AVG_CHECK_USD: Record<Stage, number> = {
  "pre-seed": 25_000,
  seed: 100_000,
  "series-a": 500_000,
  "series-b+": 2_000_000,
  growth: 5_000_000,
  institutional: 10_000_000,
};

export const DEFAULT_FUNNEL_RATES = {
  contactToReplyRate: 0.08,
  replyToMeetingRate: 0.5,
  meetingToCommitRate: 0.12,
  weeklyContactCapacity: 25,
} as const;

export type FunnelAssumptions = {
  raiseAmountUsd: number;
  avgCheckUsd: number;
  contactToReplyRate: number;
  replyToMeetingRate: number;
  meetingToCommitRate: number;
  weeklyContactCapacity: number;
};

export type FunnelResult = {
  investorsNeeded: number;
  meetingsNeeded: number;
  repliesNeeded: number;
  contactsNeeded: number;
  contactsPerWeek: number;
  weeksToClose: number | null;
};

const MIN_RATE = 0.0001;

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return MIN_RATE;
  return Math.min(Math.max(rate, MIN_RATE), 1);
}

// A cold-outreach funnel run in reverse from the goal: how many investor
// contacts does raising $N actually require, given check size and the
// contact→reply→meeting→commit conversion chain. Every stage rounds up,
// since a fraction of an investor or a meeting isn't reachable in practice.
export function computeFounderFunnel(input: FunnelAssumptions): FunnelResult {
  const raise = Math.max(input.raiseAmountUsd, 0);
  const avgCheck = Math.max(input.avgCheckUsd, 1);
  const contactToReplyRate = clampRate(input.contactToReplyRate);
  const replyToMeetingRate = clampRate(input.replyToMeetingRate);
  const meetingToCommitRate = clampRate(input.meetingToCommitRate);
  const weeklyContactCapacity = Math.max(0, input.weeklyContactCapacity);

  const investorsNeeded = Math.max(1, Math.ceil(raise / avgCheck));
  const meetingsNeeded = Math.ceil(investorsNeeded / meetingToCommitRate);
  const repliesNeeded = Math.ceil(meetingsNeeded / replyToMeetingRate);
  const contactsNeeded = Math.ceil(repliesNeeded / contactToReplyRate);
  const weeksToClose =
    weeklyContactCapacity > 0 ? Math.ceil(contactsNeeded / weeklyContactCapacity) : null;

  return {
    investorsNeeded,
    meetingsNeeded,
    repliesNeeded,
    contactsNeeded,
    contactsPerWeek: weeklyContactCapacity,
    weeksToClose,
  };
}

export function defaultAvgCheckForStage(stage: Stage | undefined): number {
  return stage ? STAGE_AVG_CHECK_USD[stage] : STAGE_AVG_CHECK_USD.seed;
}
