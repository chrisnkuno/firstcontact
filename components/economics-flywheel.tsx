"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { T } from "@/components/translation-provider";

// The reduced-motion preference is a browser-only, mutable source outside
// React, so useSyncExternalStore (not an effect + setState) is how this
// codebase reads it — see components/translation-provider.tsx.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getMotionSnapshot = () => !window.matchMedia(REDUCED_MOTION).matches;
const getMotionServerSnapshot = () => false;

// The wheel is generated from angles rather than hand-placed pixels, so the
// nodes sit exactly on the ring, the arcs meet them at a right angle, and the
// labels can be positioned by which side of the circle they fall on.
const CENTER = { x: 280, y: 210 };
const RING = 140;
const LABEL_RING = 180;
const LINE_HEIGHT = 13;
// Degrees of clearance left around each node so an arc never starts or ends
// underneath a node circle — which is what buried the old arrowheads.
const LEAD = 15;
const TRAIL = 17;

function point(degrees: number, radius: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: CENTER.x + radius * Math.cos(radians), y: CENTER.y + radius * Math.sin(radians) };
}

const steps = [
  {
    number: "01",
    label: "Capital in",
    lines: ["Capital in"],
    detail:
      "Capital formation. Outside money enters the local economy as equity, not debt — it does not need to be repaid if the bet fails, so it can fund work too early or too uncertain for a bank loan.",
  },
  {
    number: "02",
    label: "Founders build & hire",
    lines: ["Founders", "build & hire"],
    detail:
      "That capital becomes payroll, contractors, and office leases inside the local economy — spending decisions a founder controls directly, not a head-office budget line abroad.",
  },
  {
    number: "03",
    label: "Local multiplier",
    lines: ["Local", "multiplier"],
    detail:
      "The multiplier effect. Wages get re-spent at local suppliers and services, which re-spend again — a dollar of capital circulates several times through an ecosystem before it leaves.",
  },
  {
    number: "04",
    label: "Track record & proof points",
    lines: ["Track record", "& proof points"],
    detail:
      "Agglomeration. A first real outcome — a hire, a customer, an exit — becomes evidence the next investor can underwrite, and the next founder can point to. Proof compounds locally.",
  },
  {
    number: "05",
    label: "More capital attracted",
    lines: ["More capital", "attracted"],
    detail:
      "Reduced information asymmetry. Each cycle lowers the perceived risk of the next one, which is why capital-dense ecosystems keep compounding while overlooked ones stay starved for a first mover.",
  },
] as const;

const SPAN = 360 / steps.length;

const geometry = steps.map((step, index) => {
  const angle = -90 + index * SPAN;
  const node = point(angle, RING);
  const anchorPoint = point(angle, LABEL_RING);
  const cos = Math.cos((angle * Math.PI) / 180);
  const side = cos > 0.2 ? "start" : cos < -0.2 ? "end" : "middle";

  const from = point(angle + LEAD, RING);
  const to = point(angle + SPAN - TRAIL, RING);

  return {
    ...step,
    angle,
    node,
    side: side as "start" | "end" | "middle",
    // Vertically centre the label block on its anchor point.
    labelX: anchorPoint.x,
    labelY: anchorPoint.y - ((step.lines.length - 1) * LINE_HEIGHT) / 2 + 4,
    arc: `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${RING} ${RING} 0 0 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`,
  };
});

// The arc that closes the loop — "more capital attracted" back into "capital
// in". This is the link that never forms in an ecosystem without access, so it
// is the one the diagram breaks.
const CLOSING_INDEX = geometry.length - 1;
const breakAngle = geometry[CLOSING_INDEX].angle + SPAN / 2;
const breakMark = point(breakAngle, RING);
const breakLabel = point(breakAngle, RING + 36);

const ORBIT = `M ${CENTER.x} ${CENTER.y - RING} A ${RING} ${RING} 0 1 1 ${CENTER.x - 0.01} ${CENTER.y - RING}`;

export function EconomicsFlywheel() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [closed, setClosed] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const motionOk = useSyncExternalStore(subscribeMotion, getMotionSnapshot, getMotionServerSnapshot);

  // Draw the ring in only once, the first time it scrolls into view. Under
  // reduced motion the arcs are already shown undashed by CSS, so this only
  // ever removes an animation that was never going to run.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setDrawn(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const state = closed ? "closed" : "broken";

  return (
    <section className="economics-section section-shell" aria-labelledby="economics-heading">
      <div className="section-heading">
        <span>WHY IT COMPOUNDS</span>
        <h2 id="economics-heading">
          <T>Capital doesn&apos;t just fund founders.</T>
          <br />
          <T>It keeps the ecosystem running.</T>
        </h2>
        <p>
          <T>
            Access to capital isn&apos;t only a founder&apos;s problem — in economic terms, it&apos;s what starts and sustains the cycle an ecosystem
            needs to keep producing founders at all. Here is that cycle, and why a gap anywhere in it stalls the whole loop.
          </T>
        </p>
      </div>

      <div className="economics-grid">
        <div className="economics-diagram">
          <div className="flywheel-toggle" role="group" aria-label="Compare an ecosystem with and without access to capital">
            <button type="button" aria-pressed={!closed} onClick={() => setClosed(false)}>
              <T>No access to capital</T>
            </button>
            <button type="button" aria-pressed={closed} onClick={() => setClosed(true)}>
              <T>Access to capital</T>
            </button>
          </div>

          <svg
            ref={svgRef}
            className="flywheel"
            viewBox="0 0 560 390"
            data-state={state}
            data-drawn={drawn ? "true" : "false"}
            role="img"
            aria-labelledby="flywheel-title flywheel-desc"
          >
            <title id="flywheel-title">
              {closed ? "A closed capital cycle" : "A capital cycle broken at the first step"}
            </title>
            <desc id="flywheel-desc">
              {closed
                ? "A five-step loop turning continuously: capital in, founders build and hire, local multiplier, track record and proof points, more capital attracted, feeding back into capital in."
                : "The same five-step loop with the link from “more capital attracted” back to “capital in” broken, so the cycle never starts."}
            </desc>

            <defs>
              <marker id="flywheel-arrow" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5 Z" fill="var(--flywheel-live)" />
              </marker>
              <marker id="flywheel-arrow-dim" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5 Z" fill="var(--flywheel-dim)" />
              </marker>
            </defs>

            {/* Hub: names what the loop is currently doing. */}
            <g className="flywheel-hub" aria-hidden="true">
              <circle cx={CENTER.x} cy={CENTER.y} r={62} />
              <text x={CENTER.x} y={CENTER.y - 4} textAnchor="middle" className="flywheel-hub-state">
                {closed ? "COMPOUNDING" : "STALLED"}
              </text>
              <text x={CENTER.x} y={CENTER.y + 14} textAnchor="middle" className="flywheel-hub-note">
                {closed ? "every turn de-risks the next" : "the loop never starts"}
              </text>
            </g>

            {/* The four arcs that always connect, drawn in on first view. */}
            <g aria-hidden="true">
              {geometry.slice(0, CLOSING_INDEX).map((step) => (
                <path
                  key={`arc-${step.number}`}
                  className="flywheel-arc"
                  d={step.arc}
                  markerEnd={closed ? "url(#flywheel-arrow)" : "url(#flywheel-arrow-dim)"}
                />
              ))}

              {/* The closing arc, and the break that replaces it. */}
              <path
                className="flywheel-arc flywheel-arc-close"
                d={geometry[CLOSING_INDEX].arc}
                markerEnd={closed ? "url(#flywheel-arrow)" : undefined}
              />
              <g className="flywheel-break">
                <circle cx={breakMark.x} cy={breakMark.y} r={13} />
                <path
                  d={`M ${breakMark.x - 4.5} ${breakMark.y - 4.5} L ${breakMark.x + 4.5} ${breakMark.y + 4.5} M ${breakMark.x + 4.5} ${breakMark.y - 4.5} L ${breakMark.x - 4.5} ${breakMark.y + 4.5}`}
                />
                <text x={breakLabel.x} y={breakLabel.y - 4} textAnchor="end">
                  NO FIRST CHEQUE
                </text>
                <text x={breakLabel.x} y={breakLabel.y + 8} textAnchor="end">
                  THE LOOP CANNOT CLOSE
                </text>
              </g>

              {closed && motionOk && (
                <circle className="flywheel-pulse" r={5}>
                  <animateMotion dur="7s" repeatCount="indefinite" path={ORBIT} rotate="auto" />
                </circle>
              )}
            </g>

            {geometry.map((step, index) => (
              <g
                key={step.number}
                className="flywheel-node"
                data-active={active === index ? "true" : "false"}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
              >
                <circle className="flywheel-node-hit" cx={step.node.x} cy={step.node.y} r={30} />
                <circle className="flywheel-node-dot" cx={step.node.x} cy={step.node.y} r={17} />
                <text x={step.node.x} y={step.node.y + 3.5} textAnchor="middle" className="flywheel-node-number">
                  {step.number}
                </text>
                <text x={step.labelX} y={step.labelY} textAnchor={step.side} className="flywheel-node-label">
                  {step.lines.map((line, lineIndex) => (
                    <tspan key={line} x={step.labelX} dy={lineIndex === 0 ? 0 : LINE_HEIGHT}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            ))}
          </svg>

          <p className="flywheel-caption">
            {closed ? (
              <T>
                One first cheque is enough to start the turn. Every step after it makes the next investor&apos;s decision easier to underwrite.
              </T>
            ) : (
              <T>
                Nothing here is missing except the first cheque. Talent, ideas, and demand can all be present and the loop still will not turn.
              </T>
            )}
          </p>
        </div>

        <div className="economics-list">
          {geometry.map((step, index) => (
            <article
              key={step.number}
              data-active={active === index ? "true" : "false"}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              <span>
                <b>{step.number}</b> {step.label}
              </span>
              <p>
                <T>{step.detail}</T>
              </p>
            </article>
          ))}
        </div>
      </div>

      <p className="economics-footnote">
        <T>
          None of this requires a talent gap to explain who gets funded and who doesn&apos;t — a capital-access gap is enough on its own.
          Closing it is a compounding move, not a one-time transfer.
        </T>
      </p>
    </section>
  );
}
