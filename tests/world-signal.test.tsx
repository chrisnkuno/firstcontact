// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { WorldSignal } from "@/components/world-signal";
import { cubicPointAt, renderWithTranslation } from "./dom-helpers";

// public/world-map.svg is Mercator on a 1010x666 viewBox. Markers are placed
// with the map's own projection rather than by eye, so these tests re-derive
// the expected pixel for each city from its real latitude/longitude. If anyone
// nudges a marker "to look right", the projection check catches it.
const projectX = (lon: number) => 474.782 + 2.8065 * lon;
const projectY = (lat: number) => 463.003 - 160.2366 * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

const expectedHubs = [
  { id: "US", city: "New York", lon: -74.006, lat: 40.713 },
  { id: "UK", city: "London", lon: -0.128, lat: 51.507 },
  { id: "EU", city: "Frankfurt", lon: 8.682, lat: 50.111 },
  { id: "APAC", city: "Singapore", lon: 103.82, lat: 1.352 },
];

const NAIROBI = { x: projectX(36.822), y: projectY(-1.292) };

function hubMarkers(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGCircleElement>('.nodes circle')).map((circle) => ({
    x: Number(circle.getAttribute("cx")),
    y: Number(circle.getAttribute("cy")),
  }));
}

function routePaths(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGPathElement>(".route")).map(
    (path) => path.getAttribute("d") ?? "",
  );
}

afterEach(cleanup);

describe("WorldSignal marker placement", () => {
  it("places each capital region at its city's true Mercator pixel", () => {
    const { container } = renderWithTranslation(<WorldSignal />);
    const markers = hubMarkers(container);
    expect(markers).toHaveLength(expectedHubs.length);

    expectedHubs.forEach((hub, index) => {
      // One pixel of tolerance: the committed coordinates are rounded.
      expect(markers[index].x, `${hub.id} x`).toBeCloseTo(projectX(hub.lon), 0);
      expect(markers[index].y, `${hub.id} y`).toBeCloseTo(projectY(hub.lat), 0);
    });
  });

  it("labels every hub with its region code and city", () => {
    const { container } = renderWithTranslation(<WorldSignal />);
    const text = container.querySelector(".nodes")?.textContent ?? "";
    for (const hub of expectedHubs) {
      expect(text).toContain(hub.id);
      expect(text).toContain(hub.city);
    }
  });

  it("keeps every hub marker visually distinguishable", () => {
    // Regression: UK and EU sat 12px apart with a 6px marker radius each,
    // leaving the two discs visually fused.
    const { container } = renderWithTranslation(<WorldSignal />);
    const markers = hubMarkers(container);
    const radius = Number(container.querySelector(".nodes circle")?.getAttribute("r"));

    for (let i = 0; i < markers.length; i += 1) {
      for (let j = i + 1; j < markers.length; j += 1) {
        const gap = Math.hypot(markers[i].x - markers[j].x, markers[i].y - markers[j].y);
        expect(gap, `${expectedHubs[i].id}-${expectedHubs[j].id}`).toBeGreaterThan(radius * 3);
      }
    }
  });

  it("marks further founder ecosystems beyond the single routed origin", () => {
    const { container } = renderWithTranslation(<WorldSignal />);
    expect(container.querySelectorAll(".other-ecosystems circle").length).toBeGreaterThanOrEqual(3);
  });
});

describe("WorldSignal routes", () => {
  it("starts every route at the founder ecosystem", () => {
    const { container } = renderWithTranslation(<WorldSignal />);
    const routes = routePaths(container);
    expect(routes).toHaveLength(expectedHubs.length);

    for (const d of routes) {
      const start = cubicPointAt(d, 0);
      expect(start.x).toBeCloseTo(NAIROBI.x, 0);
      expect(start.y).toBeCloseTo(NAIROBI.y, 0);
    }
  });

  it("lands every route on its capital region marker", () => {
    const { container } = renderWithTranslation(<WorldSignal />);
    const markers = hubMarkers(container);

    routePaths(container).forEach((d, index) => {
      const end = cubicPointAt(d, 1);
      expect(end.x).toBeCloseTo(markers[index].x, 0);
      expect(end.y).toBeCloseTo(markers[index].y, 0);
    });
  });

  it("separates the UK and EU routes along their whole length", () => {
    // The two destinations are genuinely close, so the routes are bowed in
    // opposite directions. Previously they overlapped almost entirely.
    const { container } = renderWithTranslation(<WorldSignal />);
    const [, uk, eu] = routePaths(container);

    for (const t of [0.25, 0.5, 0.75, 0.85]) {
      const a = cubicPointAt(uk, t);
      const b = cubicPointAt(eu, t);
      expect(Math.hypot(a.x - b.x, a.y - b.y), `t=${t}`).toBeGreaterThan(30);
    }
  });
});

describe("WorldSignal legibility", () => {
  it("explains its own symbols with a legend", () => {
    const { container } = renderWithTranslation(<WorldSignal />);
    const legend = container.querySelector(".signal-legend");
    expect(legend?.querySelectorAll("dt")).toHaveLength(3);
    expect(legend?.textContent).toContain("Founder ecosystem");
    expect(legend?.textContent).toContain("Capital region");
    expect(legend?.textContent).toContain("Approved outreach");
  });

  it("describes the map for assistive technology", () => {
    const { container } = renderWithTranslation(<WorldSignal />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.querySelector("title")?.textContent).toBeTruthy();
    expect(svg?.querySelector("desc")?.textContent?.length ?? 0).toBeGreaterThan(60);
  });
});
