import type { AuthConfig } from "convex/server";

/**
 * Identity providers Convex will accept tokens from.
 *
 * The Convex Auth entry is **required and unconditional**. Convex Auth signs
 * its own JWTs with `CONVEX_SITE_URL` as the issuer and serves the matching
 * JWKS from that origin, so without this block the deployment rejects every
 * token it just issued and nobody can sign in. `CONVEX_SITE_URL` is provided by
 * Convex itself on every deployment, so it is always set.
 *
 * This was missing until 2026-08-20: the file still held only the OIDC block
 * from the FastAPI control-plane design, and the Convex Auth migration never
 * added its own provider. The test suite could not catch it — `convex-test`
 * injects an identity directly and never exercises JWT verification, which is
 * exactly the class of bug that only appears against a real deployment.
 *
 * The browser OIDC provider for the FastAPI control plane is deliberately not
 * listed. That integration is unbuilt (see docs/LAUNCH_READINESS.md), and
 * Convex validates at deploy time that every environment variable referenced in
 * this file is set — so referencing `OIDC_ISSUER_URL` here made every
 * production deploy fail on a variable no deployment had any reason to define.
 * When that path is built, add the entry back and set both variables first:
 *
 *   { domain: process.env.OIDC_ISSUER_URL, applicationID: process.env.OIDC_AUDIENCE }
 */
export default {
  providers: [
    {
      // Non-null asserted rather than defaulted: Convex sets this on every
      // deployment, and a silent `?? ""` fallback would produce a config that
      // deploys cleanly and then rejects every token at runtime.
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
