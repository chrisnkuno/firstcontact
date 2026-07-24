"use client";

import { useEffect, useRef } from "react";

const number = new Intl.NumberFormat("en-US");

// Tweens the displayed digits from the previous value to the next one
// whenever `value` changes, instead of just swapping text. gsap is
// dynamically imported so pages that never render this component don't pay
// for it in their initial bundle.
export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const from = previous.current;
    const to = value;
    previous.current = value;

    if (from === to) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.textContent = number.format(to);
      return;
    }

    let cancelled = false;
    import("gsap").then(({ gsap }) => {
      if (cancelled) return;
      const counter = { n: from };
      gsap.to(counter, {
        n: to,
        duration: 0.5,
        ease: "power2.out",
        onUpdate: () => {
          node.textContent = number.format(Math.round(counter.n));
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return <span ref={ref}>{number.format(value)}</span>;
}
