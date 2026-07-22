const routes = [
  { d: "M395 240 C 510 165, 645 145, 786 102", delay: "0s" },
  { d: "M395 240 C 535 248, 663 232, 832 205", delay: "1.2s" },
  { d: "M395 240 C 490 320, 630 338, 765 350", delay: "2.4s" },
  { d: "M395 240 C 293 180, 212 145, 93 118", delay: ".6s" },
];

export function WorldSignal() {
  return (
    <div className="signal" aria-label="Illustration of capital routes connecting global funds to overlooked ecosystems">
      <svg viewBox="0 0 920 430" role="img">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g className="map-grid">
          {Array.from({ length: 15 }, (_, i) => <line key={`v${i}`} x1={i * 66} y1="0" x2={i * 66} y2="430" />)}
          {Array.from({ length: 8 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 62} x2="920" y2={i * 62} />)}
        </g>
        <path className="land" d="M62 93l67-38 90 8 47 40-22 51-54 18-19 67-62 29-38-30 14-64-43-36zm273 73 35-47 71-11 46 31-10 51-45 25-12 91-34 73-41-43-11-75-38-49zm245-101 90-31 94 16 88 55-26 35-72-3-38 46-68-9-28-49-57-18zm89 158 57-24 47 17 31 57-27 42-61-9-44-39z" />
        {routes.map((route, index) => <g key={route.d}><path className="route" d={route.d} /><circle className="traveler" r="4" filter="url(#glow)" style={{ animationDelay: route.delay }}><animateMotion dur={`${4 + index * .4}s`} repeatCount="indefinite" path={route.d} /></circle></g>)}
        <g className="origin" transform="translate(395 240)"><circle r="31" /><circle r="15" /><circle r="4" /></g>
        <g className="nodes"><circle cx="786" cy="102" r="6" /><circle cx="832" cy="205" r="6" /><circle cx="765" cy="350" r="6" /><circle cx="93" cy="118" r="6" /></g>
      </svg>
      <span className="signal-label label-origin">OVERLOOKED<br />ECOSYSTEM</span>
      <span className="signal-label label-us">US</span><span className="signal-label label-eu">UK / EU</span><span className="signal-label label-apac">APAC</span>
      <div className="signal-status"><span /> SIGNAL ACTIVE <b>04</b></div>
    </div>
  );
}
