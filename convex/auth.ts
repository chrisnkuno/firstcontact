import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { EmailVerificationEmail, PasswordResetEmail, authEmailConfigured } from "./authEmail";
import type { DataModel } from "./_generated/dataModel";
import {
  accountRoles,
  investorTypes,
  participantKinds,
  type AccountRole,
  type InvestorType,
  type ParticipantKind,
} from "../lib/domain";

const investorTypeSet = new Set<string>(investorTypes);
const participantKindSet = new Set<string>(participantKinds);
const roleSet = new Set<string>(accountRoles);

function optionalString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/**
 * Password requirements.
 *
 * Length is the dominant factor in offline-cracking cost, so this asks for 12
 * characters rather than the library default of 8 and otherwise stays out of
 * the way — no forced character classes, which push people toward
 * `Password1!` patterns that are weaker than a longer passphrase. The obvious
 * worst cases are rejected outright.
 */
const OBVIOUS_PASSWORDS = new Set([
  "password1234",
  "123456789012",
  "qwertyuiop12",
  "firstcontact",
  "letmeinplease",
]);

function validatePasswordRequirements(password: string) {
  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }
  if (password.length > 256) {
    throw new Error("Password must be 256 characters or fewer");
  }
  if (OBVIOUS_PASSWORDS.has(password.toLowerCase())) {
    throw new Error("Choose a less predictable password");
  }
}

/**
 * Derives the stored user document from the sign-up parameters.
 *
 * Two rules here are load-bearing:
 *
 * 1. `admin` can never be self-assigned. The role is clamped to participant or
 *    investor no matter what the client sends, so the only path to an admin
 *    account is `users:promoteToAdmin`, which itself requires an existing
 *    admin (or the one-time bootstrap).
 * 2. The role-specific discriminator is only kept when it matches the role, so
 *    a participant can never carry a stale `investorType` that a dashboard
 *    might later branch on.
 *
 * This runs for every flow, including "signIn", where the params carry only
 * email and password — hence the defaults.
 */
const profile = (params: Record<string, unknown>) => {
  const email = String(params.email ?? "").trim().toLowerCase();

  const requestedRole = String(params.role ?? "participant");
  const role: AccountRole =
    roleSet.has(requestedRole) && requestedRole !== "admin"
      ? (requestedRole as AccountRole)
      : "participant";

  const requestedInvestorType = String(params.investorType ?? "");
  const investorType: InvestorType | undefined =
    role === "investor" && investorTypeSet.has(requestedInvestorType)
      ? (requestedInvestorType as InvestorType)
      : undefined;

  const requestedParticipantKind = String(params.participantKind ?? "");
  const participantKind: ParticipantKind | undefined =
    role === "participant" && participantKindSet.has(requestedParticipantKind)
      ? (requestedParticipantKind as ParticipantKind)
      : undefined;

  return {
    email,
    name: optionalString(params.name, 100),
    role,
    investorType,
    participantKind,
    organizationName: optionalString(params.organizationName, 120),
    location: optionalString(params.location, 120),
    createdAt: Date.now(),
  };
};

/**
 * Whether new accounts must confirm their address before they can sign in.
 *
 * Defaults to on wherever email can actually be sent, because the whole
 * premise of this platform is that a signal from an investor or a founder is
 * attributable to a real person who controls that address. It degrades rather
 * than breaks: a deployment with no email provider configured (a fork building
 * the marketing site, or local development) keeps the original
 * sign-up-and-you-are-in behaviour instead of creating accounts nobody can
 * ever activate. Set `REQUIRE_EMAIL_VERIFICATION=false` to opt out explicitly.
 */
function emailVerificationRequired(): boolean {
  if (!authEmailConfigured()) return false;
  return process.env.REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase() !== "false";
}

/**
 * Password reset is enabled whenever email is configured. There is no switch
 * to disable it: an account system with no recovery path is one forgotten
 * password away from a permanently locked-out user, and "contact support" is
 * not a recovery path when there is no support rota.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile,
      validatePasswordRequirements,
      ...(authEmailConfigured() ? { reset: PasswordResetEmail } : {}),
      ...(emailVerificationRequired() ? { verify: EmailVerificationEmail } : {}),
    }),
  ],
});
