"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

/**
 * The Convex client, created once at module scope.
 *
 * `NEXT_PUBLIC_CONVEX_URL` is inlined at build time. On a statically exported
 * site there is no server to read configuration at request time, so a missing
 * value cannot be recovered at runtime, so a build without it degrades to the
 * static marketing site rather than failing at runtime.
 */
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Without a deployment URL the app renders without a Convex provider at all.
  // That is safe because every component that calls a Convex hook first checks
  // `isConvexConfigured` and renders a "not configured" branch instead — so a
  // fork without a backend still gets the full static marketing site rather
  // than a page that throws on first render.
  if (!client) return <>{children}</>;

  // Tokens live in localStorage rather than an HttpOnly cookie. That is an
  // accepted consequence of serving the app from GitHub Pages, which has no
  // server to set a cookie from — it means a successful XSS could read a
  // session token, where previously it could not. The mitigations are the
  // strict meta CSP in app/layout.tsx, the absence of any HTML-injection sink
  // in this codebase, and TOTP step-up on every privileged admin action, so a
  // stolen token alone does not reach platform data. See docs/SECURITY.md.
  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}
