import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy.
 *
 * `script-src` keeps `'unsafe-inline'`, and that is a deliberate, measured
 * trade-off rather than an oversight. Next.js streams its RSC payload as ~19
 * inline `self.__next_f.push(...)` scripts per page. Removing `'unsafe-inline'`
 * means nonces, nonces must be minted per request in middleware, and a
 * statically prerendered page has no request to mint one from — the nonce in
 * the response header would not match the build-time HTML, so every script on
 * every static page would be blocked. The only way to get a nonce is to render
 * all of these pages dynamically, which is a poor trade for what is mostly a
 * set of static documentation and marketing routes.
 *
 * What the rest of the policy still buys, even with inline script allowed:
 *   - `script-src 'self'` blocks any injected `<script src="https://evil...">`.
 *   - `connect-src 'self'` blocks exfiltration to an attacker-controlled host,
 *     which is what most XSS payloads actually need in order to be useful.
 *   - no `'unsafe-eval'` in production.
 *   - `object-src`, `base-uri`, `form-action`, and `frame-ancestors` close the
 *     plugin, base-tag, form-hijack, and clickjacking vectors.
 *
 * The residual risk this leaves is HTML injection, and the codebase currently
 * has no vector for it: no `dangerouslySetInnerHTML`, no `eval`, no
 * `new Function`, no third-party script origins, self-hosted fonts, and every
 * browser fetch is same-origin. Adding any of those should mean revisiting
 * this comment. See docs/SECURITY.md.
 *
 * `style-src` allows inline styles because React renders `style={{...}}` props
 * as style attributes throughout the app; that is a much narrower risk than
 * inline script.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  // data: covers the TOTP enrolment QR code, which is generated as a data URL.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Convex is only ever reached from server code, so it is not listed here.
  // Revisit if a client component ever talks to a provider directly.
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Redundant with frame-ancestors above, kept for pre-CSP3 browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: isProduction
          ? [
              ...securityHeaders,
              // Two years, subdomains included, preload-eligible. Browsers
              // ignore HSTS over plain http, so this is inert in local dev.
              { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
            ]
          : securityHeaders,
      },
    ];
  },
};

export default nextConfig;
