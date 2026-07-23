const routes = [
  {
    d: "M555 497 C 420 425, 330 350, 230 340",
    delay: "0s",
    label: "United States",
  },
  {
    d: "M555 497 C 510 420, 480 365, 456 326",
    delay: "1.1s",
    label: "United Kingdom",
  },
  {
    d: "M555 497 C 540 430, 525 385, 505 350",
    delay: "2.2s",
    label: "European Union",
  },
  {
    d: "M555 497 C 665 515, 750 520, 833 495",
    delay: ".55s",
    label: "Asia Pacific",
  },
];

const capitalNodes = [
  { x: 230, y: 340, label: "US", anchor: "end", dx: -12, dy: -11 },
  { x: 456, y: 326, label: "UK", anchor: "end", dx: -11, dy: -11 },
  { x: 505, y: 350, label: "EU", anchor: "start", dx: 11, dy: -10 },
  { x: 833, y: 495, label: "APAC", anchor: "start", dx: 12, dy: -10 },
] as const;

export function WorldSignal() {
  return (
    <div
      className="signal"
      aria-label="Capital routes connecting global investors to overlooked ecosystems"
    >
      <svg viewBox="0 0 1010 666" role="img">
        <title>FirstContact global capital network</title>
        <desc>
          An accurate world map showing routes between an emerging ecosystem in
          East Africa and investors in the United States, United Kingdom,
          European Union, and Asia Pacific.
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
            <line
              key={`vertical-${index}`}
              x1={index * 63}
              y1="0"
              x2={index * 63}
              y2="666"
            />
          ))}
          {Array.from({ length: 11 }, (_, index) => (
            <line
              key={`horizontal-${index}`}
              x1="0"
              y1={index * 66}
              x2="1010"
              y2={index * 66}
            />
          ))}
        </g>

        <image
          className="world-map"
          href="/world-map.svg"
          width="1010"
          height="666"
          aria-hidden="true"
        />

        <g aria-hidden="true">
          {routes.map((route, index) => (
            <g key={route.label}>
              <path className="route" d={route.d} />
              <circle className="traveler" r="4" filter="url(#glow)">
                <animateMotion
                  begin={route.delay}
                  dur={`${4 + index * 0.45}s`}
                  repeatCount="indefinite"
                  path={route.d}
                />
              </circle>
            </g>
          ))}
        </g>

        <g className="origin" transform="translate(555 497)" aria-hidden="true">
          <circle r="31" />
          <circle r="15" />
          <circle r="4" />
        </g>

        <g className="nodes" aria-hidden="true">
          {capitalNodes.map((node) => (
            <g key={node.label}>
              <circle cx={node.x} cy={node.y} r="6" />
              <text
                x={node.x + node.dx}
                y={node.y + node.dy}
                textAnchor={node.anchor}
              >
                {node.label}
              </text>
            </g>
          ))}
        </g>

        <g className="origin-label" aria-hidden="true">
          <line x1="555" y1="528" x2="555" y2="545" />
          <text x="555" y="560" textAnchor="middle">
            OVERLOOKED ECOSYSTEM
          </text>
        </g>
      </svg>

      <div className="signal-status">
        <span /> SIGNAL ACTIVE <b>04</b>
      </div>
    </div>
  );
}
