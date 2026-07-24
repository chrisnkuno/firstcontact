// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { EconomicsFlywheel } from "@/components/economics-flywheel";
import { MockIntersectionObserver, installBrowserStubs, renderWithTranslation } from "./dom-helpers";

// The diagram's geometry is generated from angles rather than hand-placed
// pixels. These tests lock in the properties that generation is there to
// guarantee, because each one was previously broken by hand-tuned coordinates.
const CENTER = { x: 280, y: 210 };
const RING = 140;
const VIEWBOX = { width: 560, height: 390 };

function distanceFromCentre(x: number, y: number) {
  return Math.hypot(x - CENTER.x, y - CENTER.y);
}

function nodeDots(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGCircleElement>(".flywheel-node-dot")).map((dot) => ({
    x: Number(dot.getAttribute("cx")),
    y: Number(dot.getAttribute("cy")),
    r: Number(dot.getAttribute("r")),
  }));
}

function arcEndpoints(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGPathElement>(".flywheel-arc")).map((arc) => {
    const numbers = (arc.getAttribute("d") ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    // "M sx sy A r r 0 0 1 ex ey"
    return { start: { x: numbers[0], y: numbers[1] }, end: { x: numbers[7], y: numbers[8] } };
  });
}

beforeEach(() => {
  installBrowserStubs();
});

// Vitest runs without globals, so Testing Library's automatic cleanup hook is
// not installed for us — without this, renders accumulate in document.body and
// every screen query finds duplicates.
afterEach(cleanup);

describe("EconomicsFlywheel content", () => {
  it("renders all five steps of the cycle", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    expect(nodeDots(container)).toHaveLength(5);
    for (const number of ["01", "02", "03", "04", "05"]) {
      expect(container.querySelector(".flywheel")?.textContent).toContain(number);
    }
    expect(screen.getByText(/Capital formation/)).toBeTruthy();
    expect(screen.getByText(/multiplier effect/)).toBeTruthy();
    expect(screen.getByText(/Agglomeration/)).toBeTruthy();
  });

  it("exposes the diagram to assistive technology", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    const svg = container.querySelector(".flywheel");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.querySelector("title")?.textContent).toBeTruthy();
    expect(svg?.querySelector("desc")?.textContent).toBeTruthy();
  });
});

describe("EconomicsFlywheel geometry", () => {
  it("places every node exactly on the ring", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    for (const node of nodeDots(container)) {
      expect(distanceFromCentre(node.x, node.y)).toBeCloseTo(RING, 6);
    }
  });

  it("spaces the nodes evenly around the circle", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    const angles = nodeDots(container)
      .map((node) => (Math.atan2(node.y - CENTER.y, node.x - CENTER.x) * 180) / Math.PI)
      .map((angle) => (angle + 360) % 360)
      .sort((a, b) => a - b);
    for (let i = 0; i < angles.length; i += 1) {
      const gap = ((angles[(i + 1) % angles.length] - angles[i] + 360) % 360) || 360;
      expect(gap).toBeCloseTo(72, 4);
    }
  });

  it("keeps arcs clear of the node discs so arrowheads stay visible", () => {
    // Regression: arcs used to run node-centre to node-centre, which buried
    // every arrowhead underneath the next node.
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    const nodes = nodeDots(container);
    const nodeRadius = Math.max(...nodes.map((node) => node.r));

    for (const { start, end } of arcEndpoints(container)) {
      for (const endpoint of [start, end]) {
        const nearest = Math.min(...nodes.map((node) => Math.hypot(node.x - endpoint.x, node.y - endpoint.y)));
        expect(nearest).toBeGreaterThan(nodeRadius + 8);
      }
    }
  });

  it("fits every node number inside its own disc", () => {
    // Regression: r=7 discs carried a 9px two-digit number that overflowed them.
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    for (const node of nodeDots(container)) {
      expect(node.r).toBeGreaterThanOrEqual(12);
    }
  });

  it("keeps all drawn geometry inside the viewBox", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    const svg = container.querySelector(".flywheel");
    expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`);

    for (const text of Array.from(svg?.querySelectorAll<SVGTextElement>("text") ?? [])) {
      const x = Number(text.getAttribute("x"));
      const y = Number(text.getAttribute("y"));
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(VIEWBOX.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(VIEWBOX.height);
    }
  });
});

describe("EconomicsFlywheel broken/closed states", () => {
  it("opens on the broken loop the section copy describes", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    const svg = container.querySelector(".flywheel");
    expect(svg?.getAttribute("data-state")).toBe("broken");
    expect(svg?.textContent).toContain("STALLED");
    expect(svg?.textContent).toContain("NO FIRST CHEQUE");
    // No arrowhead on the closing arc while the loop does not close.
    expect(container.querySelector(".flywheel-arc-close")?.getAttribute("marker-end")).toBeNull();
  });

  it("closes the loop when the other state is selected", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    fireEvent.click(screen.getByRole("button", { name: "Access to capital" }));

    const svg = container.querySelector(".flywheel");
    expect(svg?.getAttribute("data-state")).toBe("closed");
    expect(svg?.textContent).toContain("COMPOUNDING");
    expect(svg?.textContent).not.toContain("STALLED");
    expect(container.querySelector(".flywheel-arc-close")?.getAttribute("marker-end")).toBe("url(#flywheel-arrow)");

    // The break annotation stays mounted on purpose so CSS can cross-fade it
    // rather than having React swap the node out mid-transition. It is inside
    // an aria-hidden group and is driven purely by data-state, so what matters
    // is that the accessible description below stops describing a break.
    expect(container.querySelector(".flywheel-break")).not.toBeNull();
    expect(svg?.querySelector("desc")?.textContent).not.toMatch(/broken/i);
  });

  it("keeps the toggle's pressed state in sync for screen readers", () => {
    renderWithTranslation(<EconomicsFlywheel />);
    const without = screen.getByRole("button", { name: "No access to capital" });
    const with_ = screen.getByRole("button", { name: "Access to capital" });

    expect(without.getAttribute("aria-pressed")).toBe("true");
    expect(with_.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(with_);
    expect(without.getAttribute("aria-pressed")).toBe("false");
    expect(with_.getAttribute("aria-pressed")).toBe("true");
  });

  it("describes the current state differently in the accessible description", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    const broken = container.querySelector(".flywheel desc")?.textContent;
    fireEvent.click(screen.getByRole("button", { name: "Access to capital" }));
    const closed = container.querySelector(".flywheel desc")?.textContent;
    expect(broken).not.toBe(closed);
    expect(broken).toMatch(/broken/i);
  });
});

describe("EconomicsFlywheel motion", () => {
  it("draws the ring in only once it scrolls into view", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    expect(container.querySelector(".flywheel")?.getAttribute("data-drawn")).toBe("false");

    act(() => MockIntersectionObserver.instances.at(-1)?.trigger());
    expect(container.querySelector(".flywheel")?.getAttribute("data-drawn")).toBe("true");
  });

  it("runs the orbiting pulse only when the loop is closed", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    expect(container.querySelector(".flywheel-pulse")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Access to capital" }));
    expect(container.querySelector(".flywheel-pulse")).not.toBeNull();
  });

  it("omits the pulse entirely when the visitor prefers reduced motion", () => {
    installBrowserStubs({ reducedMotion: true });
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    fireEvent.click(screen.getByRole("button", { name: "Access to capital" }));
    expect(container.querySelector(".flywheel-pulse")).toBeNull();
  });

  it("highlights the matching node when a list entry is hovered", () => {
    const { container } = renderWithTranslation(<EconomicsFlywheel />);
    const entries = container.querySelectorAll(".economics-list article");
    fireEvent.mouseEnter(entries[2]);

    const activeNodes = container.querySelectorAll('.flywheel-node[data-active="true"]');
    expect(activeNodes).toHaveLength(1);
    expect(activeNodes[0].textContent).toContain("03");
  });
});
