import type { convexTest } from "convex-test";
import type { Id } from "../convex/_generated/dataModel";
import type { AccountRole, InvestorType } from "../lib/domain";

type TestConvex = ReturnType<typeof convexTest>;

/**
 * Creates a user row and returns a client authenticated as them.
 *
 * Convex Auth encodes identity as `subject = "<userId>|<sessionId>"`, so a test
 * cannot just invent a token identifier the way the pre-migration tests did —
 * the id has to reference a real `users` document, because every authz helper
 * now loads that document to read the role and the suspension flag.
 */
export async function createUser(
  t: TestConvex,
  options: {
    role: AccountRole;
    email: string;
    investorType?: InvestorType;
    suspended?: boolean;
  },
) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: options.email,
      name: options.email.split("@")[0],
      role: options.role,
      investorType: options.investorType,
      createdAt: Date.now(),
      suspendedAt: options.suspended ? Date.now() : undefined,
    }),
  );

  // A real auth session row, so `getAuthSessionId` resolves to something the
  // MFA step-up records can be keyed by.
  const sessionId = await t.run(async (ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 60 * 60 * 1000 }),
  );

  return {
    userId,
    sessionId,
    as: t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://test.convex" }),
  };
}

/** Enrols and verifies TOTP for an admin, satisfying `requireAdmin`. */
export async function grantMfa(
  t: TestConvex,
  userId: Id<"users">,
  sessionId: Id<"authSessions">,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("userMfa", {
      userId,
      secret: "JBSWY3DPEHPK3PXP",
      enabled: true,
      confirmedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("sessionMfaVerifications", {
      sessionId,
      userId,
      verifiedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  });
}
