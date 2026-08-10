/**
 * URLs for the public Convex HTTP endpoints.
 *
 * Convex serves functions from `*.convex.cloud` and HTTP actions from the
 * sibling `*.convex.site` origin. Only `NEXT_PUBLIC_CONVEX_URL` is configured,
 * so the HTTP origin is derived from it rather than adding a second variable
 * that could drift out of sync with the first.
 */
function convexSiteOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return url.replace(".convex.cloud", ".convex.site").replace(/\/$/, "");
}

export function convexEndpoint(path: string): string | null {
  const origin = convexSiteOrigin();
  if (!origin) return null;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export const PUBLIC_ENDPOINTS = {
  signups: "/public/signups",
  catalogueInterest: "/public/catalogue-interest",
  translate: "/public/translate",
} as const;

/**
 * Whether this build has a backend at all.
 *
 * Inlined at build time, so it is a constant the bundler can see. Components
 * that read Convex check this *before* mounting anything that calls a Convex
 * hook — a fork of this repo without a deployment still gets a working
 * marketing site with honest "not configured" panels, rather than an app that
 * throws on first render.
 */
export const isConvexConfigured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
