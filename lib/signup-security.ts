import { createHmac } from "node:crypto";

type OriginCheck = {
  configuredOrigin?: string;
  origin: string | null;
  requestOrigin: string;
  secFetchSite: string | null;
};

function canonicalOrigin(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedSignupRequest({
  configuredOrigin,
  origin,
  requestOrigin,
  secFetchSite,
}: OriginCheck) {
  if (secFetchSite === "cross-site") return false;
  if (!origin) return true;

  const submittedOrigin = canonicalOrigin(origin);
  if (!submittedOrigin) return false;

  const allowed = new Set([
    canonicalOrigin(requestOrigin),
    canonicalOrigin(configuredOrigin),
  ]);
  allowed.delete(null);
  return allowed.has(submittedOrigin);
}

export function signupRateLimitKeys({
  address,
  email,
  secret,
}: {
  address: string;
  email: string;
  secret: string;
}) {
  const digest = (scope: string) =>
    createHmac("sha256", secret).update(scope).digest("hex");
  const normalizedAddress = address.trim() || "unknown";
  const normalizedEmail = email.trim().toLowerCase();

  return {
    addressKey: digest(`signup:address:${normalizedAddress}`),
    addressEmailKey: digest(
      `signup:address-email:${normalizedAddress}:${normalizedEmail}`,
    ),
  };
}
