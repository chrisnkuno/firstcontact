import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages.
 *
 * The whole application is now prerendered to static HTML/JS and served by
 * GitHub Pages, with Convex as the only backend. That has one security
 * consequence worth stating plainly, because it is a real regression rather
 * than a neutral change:
 *
 *   **GitHub Pages cannot set response headers.** The `headers()` config this
 *   file used to export is silently ignored by `output: "export"`, so
 *   Content-Security-Policy now ships as a `<meta http-equiv>` tag in
 *   app/layout.tsx, and the header-only policies have no equivalent at all:
 *
 *     - `Strict-Transport-Security` — gone. GitHub Pages sends its own HSTS on
 *       `*.github.io` (that domain is preloaded), so custom domains are the
 *       exposed case; a custom domain needs HSTS from a fronting CDN.
 *     - `X-Frame-Options` — gone, but `frame-ancestors 'none'` in the meta CSP
 *       covers clickjacking for every browser that matters.
 *     - `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
 *       COOP/CORP — no meta equivalent exists for these. `Referrer-Policy` is
 *       partly recovered with a `<meta name="referrer">` tag; the rest are
 *       accepted losses of defence-in-depth, documented in docs/SECURITY.md.
 *
 * `connect-src` has to widen from `'self'` to the Convex deployment, since the
 * browser now talks to Convex directly instead of through a server route. That
 * is the visible cost of moving the backend out of the app.
 */

// Empty-safe: GitHub Actions substitutes an unset repository variable as an
// empty string, not as an absent one.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // GitHub Pages serves `/some/path/` as `/some/path/index.html`; without
  // trailing slashes a deep link resolves to a 404 page instead of the route.
  trailingSlash: true,
  // No image optimizer exists on a static host, so images must be emitted as-is.
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
