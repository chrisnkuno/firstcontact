import { computeFounderFunnel, defaultAvgCheckForStage, type Stage } from "./outreach-math";
import { WEEK_MS, bucketCounts, buildFunnel, rate, recentBuckets } from "./metrics-core";

/**
 * Metrics for a participant (a founder or institution raising capital).
 *
 * The distinction that runs through this module is between *plan* and
 * *actual*. `computeFounderFunnel` answers "what would this raise require",
 * which is arithmetic over assumptions the user controls. Everything here
 * additionally reports what has genuinely happened, and — critically — never
 * blends the two into a single number, because a plan presented as an
 * observation is exactly the fabricated-metric failure this project avoids.
 */

export type ParticipantActivity = {
  contactedAt: readonly number[];
  repliedAt: readonly number[];
  meetingAt: readonly number[];
  committedUsd: number;
};

export type ParticipantProfileCompleteness = {
  hasOneLiner: boolean;
  hasTraction: boolean;
  hasImpact: boolean;
  hasFounderContext: boolean;
  hasSectors: boolean;
  hasRaiseTarget: boolean;
  hasTargetRegions: boolean;
  hasWebsite: boolean;
};

const WEEKS_CHARTED = 12;

/**
 * Profile readiness, 0–1.
 *
 * Weighted rather than a flat field count: the three narrative fields an
 * investor actually reads first (one-liner, traction, context) carry more than
 * structured metadata, so the score tracks "is this ready to be seen" rather
 * than "are all the boxes ticked".
 */
const COMPLETENESS_WEIGHTS: Record<keyof ParticipantProfileCompleteness, number> = {
  hasOneLiner: 3,
  hasTraction: 3,
  hasFounderContext: 2,
  hasImpact: 1,
  hasSectors: 1,
  hasRaiseTarget: 2,
  hasTargetRegions: 1,
  hasWebsite: 1,
};

export function profileReadiness(profile: ParticipantProfileCompleteness) {
  const entries = Object.entries(COMPLETENESS_WEIGHTS) as [
    keyof ParticipantProfileCompleteness,
    number,
  ][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const earned = entries.reduce((sum, [key, weight]) => sum + (profile[key] ? weight : 0), 0);
  const missing = entries.filter(([key]) => !profile[key]).map(([key]) => key);

  return { score: earned / total, earned, total, missing };
}

export type ParticipantMetricsInput = {
  now: number;
  raiseAmountUsd: number;
  stage?: Stage;
  avgCheckUsd?: number;
  contactToReplyRate: number;
  replyToMeetingRate: number;
  meetingToCommitRate: number;
  weeklyContactCapacity: number;
  activity: ParticipantActivity;
  profile: ParticipantProfileCompleteness;
};

export function buildParticipantMetrics(input: ParticipantMetricsInput) {
  const avgCheckUsd = input.avgCheckUsd ?? defaultAvgCheckForStage(input.stage);

  const plan = computeFounderFunnel({
    raiseAmountUsd: input.raiseAmountUsd,
    avgCheckUsd,
    contactToReplyRate: input.contactToReplyRate,
    replyToMeetingRate: input.replyToMeetingRate,
    meetingToCommitRate: input.meetingToCommitRate,
    weeklyContactCapacity: input.weeklyContactCapacity,
  });

  const contacts = input.activity.contactedAt.length;
  const replies = input.activity.repliedAt.length;
  const meetings = input.activity.meetingAt.length;

  const actualFunnel = buildFunnel([
    { key: "contacted", label: "Contacted", count: contacts },
    { key: "replied", label: "Replied", count: replies },
    { key: "met", label: "Met", count: meetings },
  ]);

  const buckets = recentBuckets(input.now, WEEKS_CHARTED, WEEK_MS);
  const contactSeries = bucketCounts(input.activity.contactedAt, buckets);
  const replySeries = bucketCounts(input.activity.repliedAt, buckets);
  const meetingSeries = bucketCounts(input.activity.meetingAt, buckets);

  const weekly = buckets.map((bucket, index) => ({
    weekStart: bucket.start,
    label: bucket.label,
    contacted: contactSeries[index],
    replied: replySeries[index],
    met: meetingSeries[index],
    // The plan's required pace, drawn alongside actuals so the gap is visible
    // rather than something the reader has to hold in their head.
    planned: plan.contactsPerWeek,
  }));

  const observedReplyRate = rate(replies, contacts);
  const observedMeetingRate = rate(meetings, replies);

  return {
    plan,
    avgCheckUsd,

    progress: {
      contacts,
      replies,
      meetings,
      committedUsd: input.activity.committedUsd,
      contactCompletion: rate(contacts, plan.contactsNeeded),
      raiseCompletion: rate(input.activity.committedUsd, input.raiseAmountUsd),
      remainingUsd: Math.max(0, input.raiseAmountUsd - input.activity.committedUsd),
    },

    actualFunnel,
    weekly,

    /**
     * Observed conversion against the planning assumption.
     *
     * `null` until there is anything to divide by — an early raise with three
     * contacts and no replies has not measured a 0% reply rate, it has not
     * measured a reply rate at all, and showing "0%" there would wrongly imply
     * the outreach is failing.
     */
    calibration: {
      observedReplyRate,
      assumedReplyRate: input.contactToReplyRate,
      replyRateDelta:
        observedReplyRate === null ? null : observedReplyRate - input.contactToReplyRate,
      observedMeetingRate,
      assumedMeetingRate: input.replyToMeetingRate,
      // Below this, the observed rates are too thin to read as signal.
      hasEnoughData: contacts >= 20,
    },

    readiness: profileReadiness(input.profile),
  };
}
