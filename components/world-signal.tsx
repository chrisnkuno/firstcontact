const routes = [
  {
    d: "M579 467 C 481 380, 366 338, 253 336",
    delay: "0s",
    label: "United States",
  },
  {
    d: "M579 467 C 547 404, 510 344, 474 295",
    delay: "1.1s",
    label: "United Kingdom",
  },
  {
    d: "M579 467 C 568 396, 533 338, 486 298",
    delay: "2.2s",
    label: "European Union",
  },
  {
    d: "M579 467 C 647 479, 715 475, 772 458",
    delay: ".55s",
    label: "Asia Pacific",
  },
];

const capitalNodes = [
  { x: 253, y: 336, label: "US", anchor: "end", dx: -12, dy: -11 },
  { x: 474, y: 295, label: "UK", anchor: "end", dx: -11, dy: -11 },
  { x: 486, y: 298, label: "EU", anchor: "start", dx: 11, dy: 14 },
  { x: 772, y: 458, label: "APAC", anchor: "start", dx: 12, dy: -10 },
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

        <g className="origin" transform="translate(579 467)" aria-hidden="true">
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
          <line x1="579" y1="498" x2="579" y2="515" />
          <text x="579" y="530" textAnchor="middle">
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
