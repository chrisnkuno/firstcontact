import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import { createUser } from "./convex-helpers";

const modules = import.meta.glob("../convex/**/*.ts");
const verifyMfa = makeFunctionReference<"mutation", { code: string }, unknown>("users:verifyMfa");
const participantActivity = makeFunctionReference<"query", Record<string, never>, { repliedAt: number[] }>("participants:myActivity");

describe("security hardening", () => {
  it("rate-limits repeated MFA guesses per authenticated session", async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await createUser(t, { role: "admin", email: "operator@example.org" });
    await t.run(async (ctx) => ctx.db.insert("userMfa", { userId, secret: "JBSWY3DPEHPK3PXP", enabled: true, updatedAt: Date.now() }));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(as.mutation(verifyMfa, { code: "000000" })).resolves.toEqual({ verified: false, error: "invalid" });
    }
    await expect(as.mutation(verifyMfa, { code: "000000" })).resolves.toEqual({ verified: false, error: "rate_limited" });
  });

  it("does not leak deployment-wide webhook activity into a participant tenant", async () => {
    const t = convexTest(schema, modules);
    const participant = await createUser(t, { role: "participant", email: "founder@example.org" });
    await t.run(async (ctx) => ctx.db.insert("webhookEvents", { provider: "resend", eventId: "foreign-event", type: "email.received", payload: { private: true }, receivedAt: Date.now() }));
    await expect(participant.as.query(participantActivity, {})).resolves.toMatchObject({ repliedAt: [] });
  });
});
