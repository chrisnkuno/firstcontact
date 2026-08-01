import type { AuthConfig } from "convex/server";

const issuer = process.env.OIDC_ISSUER_URL;
const audience = process.env.OIDC_AUDIENCE;

export default {
  providers: issuer && audience ? [{ domain: issuer, applicationID: audience }] : [],
} satisfies AuthConfig;
