import { describe, expect, it } from "vitest";
import { regionSharePercent } from "@/lib/network-stats";

describe("regionSharePercent", () => {
  it("returns the plain share for an ordinary region", () => {
    expect(regionSharePercent(50, 100)).toBe(50);
    expect(regionSharePercent(25, 100)).toBe(25);
    expect(regionSharePercent(3, 4)).toBe(75);
  });

  // Regression: the bar previously applied its own percentage twice, so a 50%
  // region rendered at 25%. The share must be linear in count/total.
  it("scales linearly — never squared", () => {
    for (const [count, total] of [
      [50, 100],
      [80, 100],
      [1, 2],
      [7, 10],
    ] as const) {
      const expected = (count / total) * 100;
      expect(regionSharePercent(count, total)).toBeCloseTo(expected, 6);
      expect(regionSharePercent(count, total)).not.toBeCloseTo((expected / 100) * expected, 6);
    }
  });

  it("floors a small but real region so it stays visible", () => {
    expect(regionSharePercent(1, 400)).toBe(3);
    expect(regionSharePercent(1, 1000)).toBe(3);
  });

  it("keeps a genuinely empty region at exactly zero", () => {
    // The visibility floor must never imply activity that did not happen.
    expect(regionSharePercent(0, 400)).toBe(0);
    expect(regionSharePercent(0, 0)).toBe(0);
  });

  it("never exceeds the track", () => {
    expect(regionSharePercent(400, 400)).toBe(100);
    expect(regionSharePercent(500, 400)).toBe(100);
  });

  it("degrades to zero on nonsense input rather than producing NaN in a style value", () => {
    expect(regionSharePercent(Number.NaN, 100)).toBe(0);
    expect(regionSharePercent(5, Number.NaN)).toBe(0);
    expect(regionSharePercent(5, -1)).toBe(0);
    expect(regionSharePercent(-5, 100)).toBe(0);
  });
});
