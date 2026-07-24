import { T } from "@/components/translation-provider";

// public/world-map.svg is a Mercator projection on a 1010×666 viewBox. Every
// marker below is placed with the projection this map actually uses:
//   x = 474.782 + 2.8065 * longitude
//   y = 463.003 - 160.2366 * ln(tan(PI/4 + latitude * PI/360))
// which reproduces the source map's own country outlines to under a pixel.
// See docs/MAP_DATA.md before moving anything by eye.

const ORIGIN = { x: 578, y: 467 }; // Nairobi, 36.82E 1.29S

// Capital regions, at the financial centre that anchors each one. London and
// Frankfurt are only 25px apart at this scale, so their routes are bowed in
// opposite directions to stay legible.
const capitalNodes = [
  { id: "US", x: 267, y: 338, city: "New York", anchor: "end" as const, dx: -13, dy: -10 },
  { id: "UK", x: 474, y: 294, city: "London", anchor: "end" as const, dx: -13, dy: -8 },
  { id: "EU", x: 499, y: 301, city: "Frankfurt", anchor: "start" as const, dx: 13, dy: -7 },
  { id: "APAC", x: 766, y: 459, city: "Singapore", anchor: "start" as const, dx: 13, dy: -9 },
];

const routes = [
  { d: "M 578 467 C 505 405, 372 332, 267 338", delay: "0s", label: "United States" },
  { d: "M 578 467 C 540 405, 470 350, 474 294", delay: "1.1s", label: "United Kingdom" },
  { d: "M 578 467 C 607 404, 562 336, 499 301", delay: "2.2s", label: "European Union" },
  { d: "M 578 467 C 640 419, 712 414, 766 459", delay: ".55s", label: "Asia Pacific" },
];

// Other ecosystems outside the capital-dense map, drawn without routes: the
// four highlighted routes are one founder's reach, not the only origin.
const otherEcosystems = [
  { x: 484, y: 445, label: "Lagos" },
  { x: 267, y: 450, label: "Bogota" },
  { x: 344, y: 531, label: "Sao Paulo" },
  { x: 728, y: 394, label: "Dhaka" },
];

export function WorldSignal() {
  return (
    <div className="signal">
      <svg viewBox="0 0 1010 666" role="img" aria-labelledby="world-signal-title world-signal-desc">
        <title id="world-signal-title">FirstContact global capital network</title>
        <desc id="world-signal-desc">
          A world map. One founder ecosystem in East Africa is connected by four outreach routes to capital regions in the United
          States, United Kingdom, European Union, and Asia Pacific. Further founder ecosystems are marked in West Africa, Latin
          America, and South Asia.
        </desc>

        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="map-grid" aria-hidden="true">
          {Array.from({ length: 17 }, (_, index) => (
            <line key={`vertical-${index}`} x1={index * 63} y1="0" x2={index * 63} y2="666" />
          ))}
          {Array.from({ length: 11 }, (_, index) => (
            <line key={`horizontal-${index}`} x1="0" y1={index * 66} x2="1010" y2={index * 66} />
          ))}
        </g>

        <image className="world-map" href="/world-map.svg" width="1010" height="666" aria-hidden="true" />

        <g className="other-ecosystems" aria-hidden="true">
          {otherEcosystems.map((place) => (
            <circle key={place.label} cx={place.x} cy={place.y} r="4.5" />
          ))}
        </g>

        <g aria-hidden="true">
          {routes.map((route, index) => (
            <g key={route.label}>
              <path className="route" d={route.d} />
              <circle className="traveler" r="4" filter="url(#glow)">
                <animateMotion begin={route.delay} dur={`${4 + index * 0.45}s`} repeatCount="indefinite" path={route.d} />
              </circle>
            </g>
          ))}
        </g>

        <g className="origin" transform={`translate(${ORIGIN.x} ${ORIGIN.y})`} aria-hidden="true">
          <circle r="31" />
          <circle r="15" />
          <circle r="4" />
        </g>

        <g className="nodes" aria-hidden="true">
          {capitalNodes.map((node) => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r="6" />
              <text x={node.x + node.dx} y={node.y + node.dy} textAnchor={node.anchor}>
                {node.id}
                <tspan className="node-city" dx="6">
                  {node.city}
                </tspan>
              </text>
            </g>
          ))}
        </g>

        <g className="origin-label" aria-hidden="true">
          <line x1={ORIGIN.x} y1={ORIGIN.y + 31} x2={ORIGIN.x} y2={ORIGIN.y + 48} />
          <text x={ORIGIN.x} y={ORIGIN.y + 63} textAnchor="middle">
            ONE FOUNDER&apos;S REACH
          </text>
        </g>
      </svg>

      <dl className="signal-legend">
        <div>
          <dt className="legend-origin" />
          <dd>
            <T>Founder ecosystem</T>
          </dd>
        </div>
        <div>
          <dt className="legend-hub" />
          <dd>
            <T>Capital region</T>
          </dd>
        </div>
        <div>
          <dt className="legend-route" />
          <dd>
            <T>Approved outreach</T>
          </dd>
        </div>
      </dl>
    </div>
  );
}
