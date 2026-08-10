/**
 * Shared primitives for the metrics layer.
 *
 * Two rules hold across every metric in this codebase and are enforced here
 * rather than restated in each module:
 *
 * 1. A rate with no denominator is `null`, never `0`. "0% of nothing" reads on
 *    a dashboard as a measured failure when it is actually an absence of data,
 *    and that distinction is the whole reason this project refuses to display
 *    fabricated numbers.
 * 2. Bucketed series are built from an explicit, contiguous calendar range, so
 *    a week with no activity renders as a genuine zero rather than vanishing
 *    and making a line chart imply continuity that did not happen.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

/** A proportion in [0,1], or null when the denominator is zero. */
export function rate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/** Formats a rate for display, preserving the "no data" case. */
export function formatRate(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export type TimeBucket = { start: number; end: number; label: string };

/**
 * Contiguous buckets covering the `count` most recent periods ending at `now`.
 *
 * Buckets are aligned to the period boundary rather than to "now minus N
 * days", so the same underlying data produces the same buckets regardless of
 * what time of day the dashboard was opened.
 */
export function recentBuckets(now: number, count: number, periodMs: number): TimeBucket[] {
  const alignedEnd = Math.floor(now / periodMs) * periodMs + periodMs;
  const buckets: TimeBucket[] = [];
  for (let index = count - 1; index >= 0; index--) {
    const end = alignedEnd - index * periodMs;
    const start = end - periodMs;
    buckets.push({ start, end, label: new Date(start).toISOString().slice(0, 10) });
  }
  return buckets;
}

/** Counts timestamped items into contiguous buckets. */
export function bucketCounts(timestamps: readonly number[], buckets: readonly TimeBucket[]): number[] {
  const counts = new Array(buckets.length).fill(0);
  for (const timestamp of timestamps) {
    for (let index = 0; index < buckets.length; index++) {
      if (timestamp >= buckets[index].start && timestamp < buckets[index].end) {
        counts[index] += 1;
        break;
      }
    }
  }
  return counts;
}

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  /** Share of the stage immediately above. Null at the top, and when empty. */
  conversionFromPrevious: number | null;
  /** Share of the very first stage. */
  shareOfEntry: number | null;
};

/**
 * Turns ordered stage counts into a funnel with both conversion rates.
 *
 * Both rates are reported because they answer different questions: step
 * conversion localises where people are lost, while share-of-entry is what
 * actually forecasts volume.
 */
export function buildFunnel(stages: readonly { key: string; label: string; count: number }[]): FunnelStage[] {
  const entry = stages[0]?.count ?? 0;
  return stages.map((stage, index) => ({
    ...stage,
    conversionFromPrevious: index === 0 ? null : rate(stage.count, stages[index - 1].count),
    shareOfEntry: index === 0 ? null : rate(stage.count, entry),
  }));
}

/**
 * Compound annual-style growth between the first and last non-empty buckets,
 * expressed per period. Returns null unless there is a positive starting value
 * and at least two periods, because growth from zero is undefined rather than
 * infinite.
 */
export function growthPerPeriod(series: readonly number[]): number | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (first <= 0 || last < 0) return null;
  return (last / first) ** (1 / (series.length - 1)) - 1;
}

/**
 * Simple moving average, used to damp the week-to-week noise inherent in low
 * absolute counts. Leading positions average over however many points exist so
 * the series keeps its full length rather than starting with gaps.
 */
export function movingAverage(series: readonly number[], window: number): number[] {
  if (window <= 1) return [...series];
  return series.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = series.slice(start, index + 1);
    return slice.reduce((total, value) => total + value, 0) / slice.length;
  });
}

/** Clamps a rate-like input to a usable [min,1] range for planning maths. */
export const MIN_RATE = 0.0001;

export function clampRate(value: number): number {
  if (!Number.isFinite(value)) return MIN_RATE;
  return Math.min(Math.max(value, MIN_RATE), 1);
}
