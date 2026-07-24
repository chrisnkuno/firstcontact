"use client";

import { useEffect, useRef } from "react";
import { T } from "@/components/translation-provider";

const nodes = [
  {
    number: "01",
    label: "Capital in",
    x: 200,
    y: 58,
    anchor: "middle" as const,
    dx: 0,
    dy: -18,
    detail: "Capital formation. Outside money enters the local economy as equity, not debt — it does not need to be repaid if the bet fails, so it can fund work too early or too uncertain for a bank loan.",
  },
  {
    number: "02",
    label: "Founders build & hire",
    x: 334,
    y: 158,
    anchor: "start" as const,
    dx: 14,
    dy: -6,
    detail: "That capital becomes payroll, contractors, and office leases inside the local economy — spending decisions a founder controls directly, not a head-office budget line abroad.",
  },
  {
    number: "03",
    label: "Local multiplier",
    x: 284,
    y: 316,
    anchor: "start" as const,
    dx: 12,
    dy: 20,
    detail: "The multiplier effect. Wages get re-spent at local suppliers and services, which re-spend again — a dollar of capital circulates several times through an ecosystem before it leaves.",
  },
  {
    number: "04",
    label: "Track record & proof points",
    x: 116,
    y: 316,
    anchor: "end" as const,
    dx: -12,
    dy: 20,
    detail: "Agglomeration. A first real outcome — a hire, a customer, an exit — becomes evidence the next investor can underwrite, and the next founder can point to. Proof compounds locally.",
  },
  {
    number: "05",
    label: "More capital attracted",
    x: 66,
    y: 158,
    anchor: "end" as const,
    dx: -14,
    dy: -6,
    detail: "Reduced information asymmetry. Each cycle lowers the perceived risk of the next one, which is why capital-dense ecosystems keep compounding while overlooked ones stay starved for a first mover.",
  },
] as const;

const center = { x: 200, y: 200, r: 140 };

function arcPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  return `M ${from.x} ${from.y} A ${center.r} ${center.r} 0 0 1 ${to.x} ${to.y}`;
}

export function EconomicsFlywheel() {
  const svgRef = useRef<SVGSVGElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || played.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (played.current || !entries[0]?.isIntersecting) return;
        played.current = true;
        observer.disconnect();

        import("animejs").then(({ animate, stagger }) => {
          const arcs = svg.querySelectorAll<SVGPathElement>(".flywheel-arc");
          const dots = svg.querySelectorAll<SVGCircleElement>(".flywheel-node-dot");

          arcs.forEach((arc) => {
            const length = arc.getTotalLength();
            arc.style.strokeDasharray = `${length}`;
            arc.style.strokeDashoffset = `${length}`;
          });
          dots.forEach((dot) => dot.setAttribute("r", "0"));

          animate(arcs, {
            strokeDashoffset: 0,
            duration: 700,
            delay: stagger(220),
            ease: "inOutQuad",
          });
          animate(dots, {
            r: [0, 7],
            duration: 350,
            delay: stagger(220, { start: 260 }),
            ease: "outBack",
          });
        });
      },
      { threshold: 0.4 },
    );

    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="economics-section section-shell" aria-labelledby="economics-heading">
      <div className="section-heading">
        <span>WHY IT COMPOUNDS</span>
        <h2>
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
          <svg ref={svgRef} viewBox="0 0 400 400" role="img" aria-labelledby="economics-heading economics-diagram-desc">
            <desc id="economics-diagram-desc">
              A five-step cycle: capital in, founders build and hire, local economic multiplier, track record and proof points, more
              capital attracted, looping back to capital in.
            </desc>
            {nodes.map((node, index) => {
              const next = nodes[(index + 1) % nodes.length];
              return (
                <path
                  key={`arc-${node.number}`}
                  className="flywheel-arc"
                  d={arcPath(node, next)}
                  fill="none"
                  stroke="var(--acid)"
                  strokeWidth={2}
                  markerEnd="url(#flywheel-arrow)"
                />
              );
            })}
            <defs>
              <marker id="flywheel-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="var(--acid)" />
              </marker>
            </defs>
            {nodes.map((node) => (
              <g key={node.number}>
                <circle className="flywheel-node-dot" cx={node.x} cy={node.y} r={7} fill="var(--dark)" stroke="var(--acid)" strokeWidth={2} />
                <text x={node.x} y={node.y + 3} textAnchor="middle" className="flywheel-node-number">
                  {node.number}
                </text>
                <text
                  x={node.x + node.dx}
                  y={node.y + node.dy}
                  textAnchor={node.anchor}
                  className="flywheel-node-label"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="economics-list">
          {nodes.map((node) => (
            <article key={node.number}>
              <span>
                {node.number} · {node.label}
              </span>
              <p>
                <T>{node.detail}</T>
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
