import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import { createUser } from "./convex-helpers";

const modules = import.meta.glob("../convex/**/*.ts");

/**
 * Carrying the public interest form into the workspace.
 *
 * The pipeline filled up while the catalogue stayed empty, and the reason was
 * friction rather than a missing feature: a founder who had already written a
 * long pitch into the public form had to type all of it again to be listed.
 * These tests pin the two properties that make the shortcut safe — it returns
 * only the caller's own submission, and it never invents or truncates text.
 */

type Draft = {
  organizationName: string;
  website: string;
  location: string;
  stage: string;
  targetRegions: string[];
  oneLiner: string;
  founderContext: string;
} | null;

const mySignupDraft = makeFunctionReference<"query", Record<string, never>, Draft>(
  "users:mySignupDraft",
);

async function seedSignup(
  t: ReturnType<typeof convexTest>,
  email: string,
  overrides: Record<string, unknown> = {},
) {
  await t.run(async (ctx) =>
    ctx.db.insert("interestSignups", {
      accountType: "startup",
      name: "Founder",
      email,
      organizationName: "Cover Soko Ltd.",
      website: "https://coversoko.rw/",
      location: "Kigali",
      stage: "pre-seed",
      targetRegions: ["EU", "UK"],
      summary: "An insuretech enhancing digital distribution of insurance across Africa.",
      context: "Insurance penetration in Rwanda sits under three percent against a global average nearer fifteen.",
      goals: ["raise-capital"],
      referralSource: "search",
      source: "web-onboarding",
      status: "new",
      productUpdates: false,
      submissionCount: 1,
      consentRecordedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    }),
  );
}

describe("users:mySignupDraft", () => {
  it("returns the caller's own submission", async () => {
    const t = convexTest(schema, modules);
    await seedSignup(t, "ely@coversoko.rw");
    const founder = await createUser(t, { role: "participant", email: "ely@coversoko.rw" });

    const draft = await founder.as.query(mySignupDraft, {});
    expect(draft?.organizationName).toBe("Cover Soko Ltd.");
    expect(draft?.website).toBe("https://coversoko.rw/");
    expect(draft?.stage).toBe("pre-seed");
    expect(draft?.targetRegions).toEqual(["EU", "UK"]);
  });

  it("never returns someone else's submission", async () => {
    const t = convexTest(schema, modules);
    await seedSignup(t, "ely@coversoko.rw");
    const stranger = await createUser(t, { role: "participant", email: "someone@else.test" });

    expect(await stranger.as.query(mySignupDraft, {})).toBeNull();
  });

  it("returns null for a signed-out caller", async () => {
    const t = convexTest(schema, modules);
    await seedSignup(t, "ely@coversoko.rw");

    expect(await t.query(mySignupDraft, {})).toBeNull();
  });

  it("returns null when the account never used the public form", async () => {
    const t = convexTest(schema, modules);
    const founder = await createUser(t, { role: "participant", email: "direct@example.test" });

    expect(await founder.as.query(mySignupDraft, {})).toBeNull();
  });

  it("passes long text through verbatim rather than truncating it", async () => {
    const t = convexTest(schema, modules);
    const long = "x".repeat(2000);
    await seedSignup(t, "ely@coversoko.rw", { context: long });
    const founder = await createUser(t, { role: "participant", email: "ely@coversoko.rw" });

    // The query is deliberately not where length is decided. Trimming here
    // would hand the UI a mangled sentence it could not tell from the original;
    // the form drops an over-long value instead, leaving the field empty.
    expect((await founder.as.query(mySignupDraft, {}))?.founderContext).toBe(long);
  });

  it("substitutes empty strings for fields the form left blank", async () => {
    const t = convexTest(schema, modules);
    await seedSignup(t, "ely@coversoko.rw", { website: undefined, targetRegions: [] });
    const founder = await createUser(t, { role: "participant", email: "ely@coversoko.rw" });

    const draft = await founder.as.query(mySignupDraft, {});
    expect(draft?.website).toBe("");
    expect(draft?.targetRegions).toEqual([]);
  });
});
