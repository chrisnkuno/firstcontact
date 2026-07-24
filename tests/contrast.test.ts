import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Colour contrast is easy to regress by eye — several of the values checked
// here were originally set to shades that looked fine on a bright monitor and
// measured below WCAG AA. This suite reads the real stylesheet, so changing a
// colour in globals.css re-runs the maths rather than silently drifting.

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

function relativeLuminance(hex: string) {
  const channels = (hex.replace("#", "").match(/../g) ?? []).map((pair) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/** Resolves a `var(--token)` reference against the custom properties on :root. */
function resolveToken(value: string): string | null {
  const token = value.match(/^var\(\s*(--[\w-]+)/)?.[1];
  if (!token) return /^#[0-9a-f]{3,8}$/i.test(value) ? value : null;
  const declared = css.match(new RegExp(`${token}\\s*:\\s*(#[0-9a-f]{3,8})`, "i"))?.[1];
  return declared ?? null;
}

/** Last declaration of `property` inside any rule for `selector` — cascade order. */
function declaredColour(selector: string, property: "color" | "fill") {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocks = [...css.matchAll(new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))];
  let found: string | null = null;
  for (const block of blocks) {
    const match = block[1].match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*(#[0-9a-f]{3,8}|var\\([^)]*\\))`, "i"));
    if (match) found = resolveToken(match[1]) ?? found;
  }
  return found;
}

const PAPER = "#f2f0e9";
const BENTO_HOVER = "#f8f7f2";
const PANEL = "#e6e3da";
const NETWORK = "#101f19";
const FOOTER = "#0d1d17";
const THESIS = "#12251e";

// Every pairing is small text (under 18.66px), so the AA threshold is 4.5:1.
const pairings: Array<[label: string, selector: string, property: "color" | "fill", background: string]> = [
  ["hero trust line", ".trust-line", "color", PAPER],
  ["bento card eyebrow", ".system-bento article>span", "color", BENTO_HOVER],
  ["bento body copy", ".system-bento p", "color", BENTO_HOVER],
  ["pipeline stage number", ".mini-flow b", "color", BENTO_HOVER],
  ["pipeline stage detail", ".mini-flow small", "color", BENTO_HOVER],
  ["pipeline stage name", ".mini-flow strong", "color", BENTO_HOVER],
  ["delivery timeline label", ".signal-line li", "color", BENTO_HOVER],
  ["flywheel hub caption", ".flywheel-hub-note", "fill", PAPER],
  ["flywheel node label", ".flywheel-node-label", "fill", PAPER],
  ["flywheel break annotation", ".flywheel-break text", "fill", PAPER],
  ["map legend", ".signal-legend dd", "color", PAPER],
  ["map hub city", ".nodes .node-city", "fill", PAPER],
  ["principles body copy", ".principle-list p", "color", PANEL],
  ["principles number", ".principle-list article>b", "color", PANEL],
  ["signal region footnote", ".signal-regions small", "color", NETWORK],
  ["signal stat label", ".signal-stats span", "color", NETWORK],
  ["footer body copy", ".footer p", "color", FOOTER],
  ["footer column heading", ".footer div>span", "color", FOOTER],
  ["thesis band copy", ".thesis-copy", "color", THESIS],
];

describe("WCAG AA contrast in globals.css", () => {
  it.each(pairings)("%s clears 4.5:1", (_label, selector, property, background) => {
    const colour = declaredColour(selector, property);
    expect(colour, `no ${property} found for ${selector}`).not.toBeNull();
    expect(contrastRatio(colour as string, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the flywheel's live stroke readable against paper", () => {
    // Regression: these arcs were originally stroked in --acid (#c8fa52) on
    // --paper, a ratio of roughly 1.03:1, which made them invisible.
    const live = css.match(/--flywheel-live:\s*(#[0-9a-f]{6})/i)?.[1];
    expect(live).toBeTruthy();
    expect(contrastRatio(live as string, PAPER)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio("#c8fa52", PAPER)).toBeLessThan(1.1); // why the change was needed
  });
});

describe("contrastRatio helper", () => {
  it("matches known reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#3f7048", "#f2f0e9")).toBeCloseTo(contrastRatio("#f2f0e9", "#3f7048"), 10);
  });
});
