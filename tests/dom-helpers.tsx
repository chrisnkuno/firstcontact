import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { TranslationProvider } from "@/components/translation-provider";

// jsdom implements neither of these, and both are load-bearing for the
// homepage diagrams: matchMedia drives the reduced-motion behaviour, and
// IntersectionObserver drives the flywheel's draw-in on first scroll.

type ObserverEntry = { target: Element; isIntersecting: boolean };

export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  private readonly elements = new Set<Element>();

  constructor(private readonly callback: (entries: ObserverEntry[], observer: unknown) => void) {
    MockIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }
  unobserve(element: Element) {
    this.elements.delete(element);
  }
  disconnect() {
    this.elements.clear();
  }

  /** Simulate the observed elements scrolling into view. */
  trigger(isIntersecting = true) {
    this.callback(
      Array.from(this.elements, (target) => ({ target, isIntersecting })),
      this,
    );
  }

  static reset() {
    MockIntersectionObserver.instances = [];
  }
}

export function installBrowserStubs({ reducedMotion = false } = {}) {
  MockIntersectionObserver.reset();

  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof window.IntersectionObserver;
}

export function renderWithTranslation(ui: ReactElement) {
  return render(<TranslationProvider>{ui}</TranslationProvider>);
}

/** Point on a cubic Bézier `M x0 y0 C x1 y1, x2 y2, x3 y3` path at position t. */
export function cubicPointAt(d: string, t: number) {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length < 8) throw new Error(`Not a cubic path: ${d}`);
  const [x0, y0, x1, y1, x2, y2, x3, y3] = numbers;
  const u = 1 - t;
  const at = (a: number, b: number, c: number, e: number) =>
    u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e;
  return { x: at(x0, x1, x2, x3), y: at(y0, y1, y2, y3) };
}
