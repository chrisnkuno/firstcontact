import { describe, expect, it } from "vitest";
import {
  computeFounderFunnel,
  defaultAvgCheckForStage,
  DEFAULT_FUNNEL_RATES,
  STAGE_AVG_CHECK_USD,
} from "@/lib/outreach-math";

describe("computeFounderFunnel", () => {
  it("chains raise amount through the check-size, commit, meeting, and reply rates", () => {
    const result = computeFounderFunnel({
      raiseAmountUsd: 1_000_000,
      avgCheckUsd: 100_000,
      contactToReplyRate: 0.1,
      replyToMeetingRate: 0.5,
      meetingToCommitRate: 0.2,
      weeklyContactCapacity: 20,
    });

    // 1,000,000 / 100,000 = 10 investors
    expect(result.investorsNeeded).toBe(10);
    // 10 / 0.2 = 50 meetings
    expect(result.meetingsNeeded).toBe(50);
    // 50 / 0.5 = 100 replies
    expect(result.repliesNeeded).toBe(100);
    // 100 / 0.1 = 1000 contacts
    expect(result.contactsNeeded).toBe(1000);
    // 1000 / 20 = 50 weeks
    expect(result.weeksToClose).toBe(50);
  });

  it("rounds every stage up so partial investors/meetings are never implied", () => {
    const result = computeFounderFunnel({
      raiseAmountUsd: 250_000,
      avgCheckUsd: 100_000,
      contactToReplyRate: 0.08,
      replyToMeetingRate: 0.5,
      meetingToCommitRate: 0.12,
      weeklyContactCapacity: 25,
    });

    expect(result.investorsNeeded).toBe(3);
    expect(Number.isInteger(result.meetingsNeeded)).toBe(true);
    expect(Number.isInteger(result.repliesNeeded)).toBe(true);
    expect(Number.isInteger(result.contactsNeeded)).toBe(true);
  });

  it("never divides by zero when a rate is set to 0", () => {
    const result = computeFounderFunnel({
      raiseAmountUsd: 500_000,
      avgCheckUsd: 50_000,
      contactToReplyRate: 0,
      replyToMeetingRate: 0,
      meetingToCommitRate: 0,
      weeklyContactCapacity: 10,
    });

    expect(Number.isFinite(result.contactsNeeded)).toBe(true);
    expect(result.contactsNeeded).toBeGreaterThan(0);
  });

  it("returns a null timeline instead of Infinity when weekly capacity is 0", () => {
    const result = computeFounderFunnel({
      raiseAmountUsd: 500_000,
      avgCheckUsd: 50_000,
      ...DEFAULT_FUNNEL_RATES,
      weeklyContactCapacity: 0,
    });

    expect(result.weeksToClose).toBeNull();
  });

  it("treats a negative raise amount as needing at least one investor", () => {
    const result = computeFounderFunnel({
      raiseAmountUsd: -100,
      avgCheckUsd: 50_000,
      ...DEFAULT_FUNNEL_RATES,
    });

    expect(result.investorsNeeded).toBe(1);
  });
});

describe("defaultAvgCheckForStage", () => {
  it("returns the stage-specific default check size", () => {
    expect(defaultAvgCheckForStage("pre-seed")).toBe(STAGE_AVG_CHECK_USD["pre-seed"]);
    expect(defaultAvgCheckForStage("series-a")).toBe(STAGE_AVG_CHECK_USD["series-a"]);
  });

  it("falls back to the seed default when no stage is given", () => {
    expect(defaultAvgCheckForStage(undefined)).toBe(STAGE_AVG_CHECK_USD.seed);
  });
});
