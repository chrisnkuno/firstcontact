/**
 * Build-time site configuration.
 *
 * Every value here is read from an environment variable that may be **present
 * but empty**. GitHub Actions substitutes an unset repository variable as an
 * empty string rather than omitting it, so `process.env.X ?? fallback` does not
 * fire — `""` is neither null nor undefined — and `new URL("")` then throws
 * `ERR_INVALID_URL` during static export. That is exactly how the first Pages
 * build failed, and it failed at build time in CI while passing locally, where
 * the variable was genuinely absent.
 *
 * So: treat empty as unset, in one place, rather than at each call site.
 */
function fromEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const DEFAULT_ORIGIN = "http://localhost:3000";

/** Canonical site origin. Always a valid absolute URL. */
export function siteOrigin(): string {
  const configured = fromEnv(process.env.NEXT_PUBLIC_APP_URL);
  if (!configured) return DEFAULT_ORIGIN;
  try {
    return new URL(configured).origin;
  } catch {
    // A malformed value must not take the whole build down; the site still
    // renders, with links pointing at the local default.
    return DEFAULT_ORIGIN;
  }
}

/** Convex deployment origins, or null when this build has no backend. */
export function convexOrigins(): { api: string; site: string; socket: string } | null {
  const configured = fromEnv(process.env.NEXT_PUBLIC_CONVEX_URL);
  if (!configured) return null;
  try {
    const api = new URL(configured).origin;
    return {
      api,
      site: api.replace(".convex.cloud", ".convex.site"),
      socket: api.replace(/^https:/, "wss:"),
    };
  } catch {
    return null;
  }
}

export const basePath = fromEnv(process.env.NEXT_PUBLIC_BASE_PATH);
