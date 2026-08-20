import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import { TranslationProvider } from "@/components/translation-provider";
import { ConvexClientProvider } from "@/components/convex-provider";
import { ErrorReporter } from "@/components/error-reporter";
import { convexOrigins, siteOrigin } from "@/lib/site-config";

/**
 * Content-Security-Policy, as a meta tag.
 *
 * A static host cannot set response headers, so the policy ships in the
 * document. Two differences from the header version this replaces:
 *
 *  - `connect-src` must now name the Convex deployment. The browser talks to
 *    Convex directly (websocket for queries, HTTPS for actions and the auth
 *    endpoints on the sibling `.convex.site` origin), where it previously only
 *    ever talked to same-origin Next.js routes. Narrowing this back to `'self'`
 *    would break the entire application.
 *  - `frame-ancestors` is *not* enforceable from a meta tag — browsers ignore
 *    it there. Clickjacking protection therefore depends on GitHub Pages'
 *    behaviour rather than on this policy; it is listed anyway so the intent
 *    survives if the app moves to a host that can send headers.
 *
 * `script-src 'unsafe-inline'` remains, for the same reason as before: Next
 * streams its RSC payload as inline scripts, and a statically exported page has
 * no request from which to mint a nonce.
 */
const convex = convexOrigins();

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  ["connect-src 'self'", convex?.api, convex?.site, convex?.socket].filter(Boolean).join(" "),
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const metadata: Metadata = {
  title: { default: "FirstContact — Capital should travel further", template: "%s · FirstContact" },
  description:
    "Open-source infrastructure connecting overlooked founders and institutions with aligned global investors.",
  metadataBase: new URL(siteOrigin()),
  applicationName: "FirstContact",
  authors: [{ name: "FirstContact contributors", url: "https://github.com/chrisnkuno/firstcontact" }],
  keywords: ["venture capital", "fundraising", "startup infrastructure", "impact investing", "open source"],
  openGraph: {
    title: "FirstContact — Capital should travel further",
    description:
      "Open infrastructure helping overlooked founders find and thoughtfully approach aligned investors worldwide.",
    type: "website",
    siteName: "FirstContact",
  },
  twitter: {
    card: "summary_large_image",
    title: "FirstContact — Capital should travel further",
    description: "Open infrastructure for capital access beyond capital-dense ecosystems.",
  },
};

export const viewport: Viewport = { themeColor: "#f2f0e9", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
        {/* Partially recovers the Referrer-Policy header, which a static host
            cannot send. No meta equivalent exists for X-Content-Type-Options,
            Permissions-Policy, COOP or CORP — see docs/SECURITY.md. */}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <ConvexClientProvider>
          {/* Inside the provider so it can reach Convex, and rendering nothing,
              so it cannot affect layout or paint. */}
          <ErrorReporter />
          <TranslationProvider>{children}</TranslationProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
