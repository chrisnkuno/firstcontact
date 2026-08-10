import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  WEEK_MS,
  bucketCounts,
  buildFunnel,
  formatRate,
  growthPerPeriod,
  movingAverage,
  rate,
  recentBuckets,
} from "@/lib/metrics-core";

describe("rate", () => {
  // The central rule of this codebase's metrics layer: no denominator means
  // "not measured", which is a different claim from "measured zero".
  it("returns null rather than zero when there is no denominator", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 0)).toBeNull();
    expect(rate(0, 10)).toBe(0);
  });

  it("returns null for non-finite inputs instead of NaN", () => {
    expect(rate(Number.NaN, 10)).toBeNull();
    expect(rate(1, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("formats a missing rate as an em dash, not 0%", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(0)).toBe("0.0%");
    expect(formatRate(0.1234, 1)).toBe("12.3%");
  });
});

describe("recentBuckets", () => {
  it("produces contiguous, non-overlapping buckets", () => {
    const buckets = recentBuckets(Date.parse("2026-08-09T13:45:00Z"), 4, WEEK_MS);
    expect(buckets).toHaveLength(4);
    for (let index = 1; index < buckets.length; index++) {
      expect(buckets[index].start).toBe(buckets[index - 1].end);
    }
  });

  // Alignment to the period boundary is what makes the same data produce the
  // same chart regardless of what time the dashboard was opened.
  it("aligns to the period boundary, so the time of day does not shift buckets", () => {
    const morning = recentBuckets(Date.parse("2026-08-09T06:00:00Z"), 3, DAY_MS);
    const evening = recentBuckets(Date.parse("2026-08-09T23:00:00Z"), 3, DAY_MS);
    expect(morning.map((b) => b.start)).toEqual(evening.map((b) => b.start));
  });

  it("counts a timestamp into exactly one bucket", () => {
    const now = Date.parse("2026-08-09T12:00:00Z");
    const buckets = recentBuckets(now, 3, DAY_MS);
    const counts = bucketCounts([buckets[1].start, buckets[1].end - 1], buckets);
    expect(counts).toEqual([0, 2, 0]);
  });

  it("keeps empty periods as explicit zeros rather than dropping them", () => {
    const now = Date.parse("2026-08-09T12:00:00Z");
    const buckets = recentBuckets(now, 4, DAY_MS);
    expect(bucketCounts([buckets[0].start], buckets)).toEqual([1, 0, 0, 0]);
  });
});

describe("buildFunnel", () => {
  it("reports both step conversion and share of entry", () => {
    const funnel = buildFunnel([
      { key: "a", label: "A", count: 100 },
      { key: "b", label: "B", count: 50 },
      { key: "c", label: "C", count: 10 },
    ]);

    expect(funnel[0].conversionFromPrevious).toBeNull();
    expect(funnel[1].conversionFromPrevious).toBe(0.5);
    expect(funnel[2].conversionFromPrevious).toBe(0.2);
    expect(funnel[2].shareOfEntry).toBe(0.1);
  });

  it("reports null conversion when the previous stage is empty", () => {
    const funnel = buildFunnel([
      { key: "a", label: "A", count: 0 },
      { key: "b", label: "B", count: 0 },
    ]);
    expect(funnel[1].conversionFromPrevious).toBeNull();
  });
});

describe("growthPerPeriod", () => {
  it("computes per-period compound growth", () => {
    // 10 → 20 → 40 is a doubling each period.
    expect(growthPerPeriod([10, 20, 40])).toBeCloseTo(1, 10);
  });

  it("returns null when growth is undefined rather than infinite", () => {
    expect(growthPerPeriod([0, 5])).toBeNull();
    expect(growthPerPeriod([5])).toBeNull();
  });
});

describe("movingAverage", () => {
  it("keeps the series length by averaging over available points", () => {
    expect(movingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
  });

  it("is the identity for a window of one", () => {
    expect(movingAverage([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
});
