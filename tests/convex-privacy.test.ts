import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { createUser, grantMfa } from "./convex-helpers";

const modules = import.meta.glob("../convex/**/*.ts");
const submit = makeFunctionReference<"mutation", { kind: "access" | "correction" | "deletion" | "restriction" | "objection" | "appeal"; jurisdiction: "US" | "UK" | "EU" | "APAC" | "OTHER"; details: string }, { requestId: Id<"privacyRequests">; status: "submitted" }>("privacy:submitRequest");
const cancel = makeFunctionReference<"mutation", { requestId: Id<"privacyRequests"> }, { cancelled: boolean }>("privacy:cancelRequest");
const dataExport = makeFunctionReference<"query", Record<string, never>, unknown>("privacy:myDataExport");
const list = makeFunctionReference<"query", { status: "submitted" | "in_review" | "completed" | "denied" | "cancelled" }, unknown[]>("privacy:listRequests");

describe("privacy data boundary", () => {
  it("requires authentication for requests and exports", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(dataExport, {})).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.mutation(submit, { kind: "access", jurisdiction: "EU", details: "" })).rejects.toThrow("UNAUTHENTICATED");
  });

  it("does not let one account cancel another account's request", async () => {
    const t = convexTest(schema, modules);
    const first = await createUser(t, { role: "participant", email: "first@example.org" });
    const second = await createUser(t, { role: "participant", email: "second@example.org" });
    const request = await first.as.mutation(submit, { kind: "deletion", jurisdiction: "UK", details: "Close my account" });
    await expect(second.as.mutation(cancel, { requestId: request.requestId })).rejects.toThrow("FORBIDDEN");
    await expect(first.as.mutation(cancel, { requestId: request.requestId })).resolves.toEqual({ cancelled: true });
  });

  it("keeps the operator queue behind role and MFA step-up", async () => {
    const t = convexTest(schema, modules);
    const participant = await createUser(t, { role: "participant", email: "person@example.org" });
    await participant.as.mutation(submit, { kind: "access", jurisdiction: "APAC", details: "" });
    await expect(participant.as.query(list, { status: "submitted" })).rejects.toThrow("FORBIDDEN");

    const admin = await createUser(t, { role: "admin", email: "operator@example.org" });
    await expect(admin.as.query(list, { status: "submitted" })).rejects.toThrow("MFA_NOT_ENROLLED");
    await grantMfa(t, admin.userId, admin.sessionId);
    await expect(admin.as.query(list, { status: "submitted" })).resolves.toHaveLength(1);
  });

  it("never exports authentication secrets", async () => {
    const t = convexTest(schema, modules);
    const user = await createUser(t, { role: "participant", email: "owner@example.org" });
    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", { userId: user.userId, provider: "password", providerAccountId: "owner@example.org", secret: "must-never-leave-server" });
      await ctx.db.insert("userMfa", { userId: user.userId, secret: "mfa-must-stay-server-side", enabled: false, updatedAt: Date.now() });
    });
    const exported = JSON.stringify(await user.as.query(dataExport, {}));
    expect(exported).not.toContain("must-never-leave-server");
    expect(exported).not.toContain("mfa-must-stay-server-side");
  });
});
