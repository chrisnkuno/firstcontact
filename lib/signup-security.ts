type OriginCheck = {
  allowedOrigins: readonly (string | undefined)[];
  origin: string | null;
};

function canonicalOrigin(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Origin allowlist for the public ingestion endpoints.
 *
 * These endpoints used to be same-origin Next.js routes, where `Sec-Fetch-Site:
 * cross-site` was a meaningful rejection. They are now Convex HTTP actions
 * called from a different origin by design (the static site on GitHub Pages
 * talks to `*.convex.site`), so every legitimate browser request is
 * cross-site and that signal no longer separates friend from foe. An explicit
 * allowlist does.
 *
 * A request with no `Origin` header at all is allowed through: browsers always
 * send it on cross-origin POSTs, so its absence means a non-browser client
 * (curl, a server-to-server integration), which is not the threat this guard
 * addresses. Rate limiting, not this check, is what bounds those.
 */
export function isTrustedSubmissionOrigin({ allowedOrigins, origin }: OriginCheck) {
  if (!origin) return true;

  const submitted = canonicalOrigin(origin);
  if (!submitted) return false;

  const allowed = new Set(allowedOrigins.map(canonicalOrigin));
  allowed.delete(null);
  return allowed.has(submitted);
}

/** Origins permitted to call the public endpoints, from deployment config. */
export function configuredAllowedOrigins(): string[] {
  return [process.env.SITE_ORIGIN, process.env.SITE_ORIGIN_ALTERNATE]
    .map((value) => canonicalOrigin(value))
    .filter((value): value is string => value !== null);
}
