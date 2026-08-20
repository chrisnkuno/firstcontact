import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import { createUser, grantMfa } from "./convex-helpers";

const modules = import.meta.glob("../convex/**/*.ts");

/**
 * The publication lifecycle and the interest loop.
 *
 * This is the path that makes the product two-sided — a founder publishing
 * something an investor can find, and an investor's response reaching the
 * founder. Before it existed, `catalogueListings` had no writer at all, so the
 * catalogue was structurally incapable of being non-empty. These tests exist to
 * keep that from silently regressing, and to pin the two disclosure rules that
 * matter: nothing is public until an operator approves it, and no contact
 * detail is released until the founder accepts.
 */

const createOrganization = makeFunctionReference<
  "mutation",
  { name: string; slug: string },
  { organizationId: string }
>("organizations:create");

const createProfile = makeFunctionReference<"mutation", Record<string, unknown>, { startupProfileId: string }>(
  "profiles:create",
);

const saveListing = makeFunctionReference<"mutation", Record<string, unknown>, { listingId: string }>(
  "catalogue:saveListing",
);
const submitForReview = makeFunctionReference<"mutation", { listingId: string }, { visibility: string }>(
  "catalogue:submitForReview",
);
const withdraw = makeFunctionReference<"mutation", { listingId: string }, { visibility: string }>(
  "catalogue:withdraw",
);
const decideListing = makeFunctionReference<
  "mutation",
  { listingId: string; approve: boolean; reason?: string },
  { visibility: string }
>("catalogue:decideListing");
const reviewQueue = makeFunctionReference<"query", Record<string, never>, unknown[]>(
  "catalogue:reviewQueue",
);
const listPublished = makeFunctionReference<"query", Record<string, never>, unknown[]>(
  "catalogue:listPublished",
);
const myListing = makeFunctionReference<"query", Record<string, never>, { listing: { visibility: string } | null } | null>(
  "catalogue:myListing",
);
const myListingInterests = makeFunctionReference<
  "query",
  Record<string, never>,
  { id: string; status: string; investorEmail: string | null }[]
>("catalogue:myListingInterests");
const respondToInterest = makeFunctionReference<
  "mutation",
  { interestId: string; accept: boolean },
  { status: string }
>("catalogue:respondToInterest");

const expressInterest = makeFunctionReference<
  "mutation",
  { listingId: string; note?: string },
  { created: boolean }
>("investors:expressInterest");
const myInterests = makeFunctionReference<
  "query",
  Record<string, never>,
  { status: string; website: string | null }[]
>("investors:myInterests");

const PROFILE = {
  name: "Kigali Agritech",
  organizationType: "startup" as const,
  website: "https://kigali-agritech.example",
  location: "Kigali, Rwanda",
  region: "Africa" as const,
  stage: "seed" as const,
  sectors: ["agritech"],
  raiseAmountUsd: 500_000,
  oneLiner: "Cold chain logistics for smallholder farmers across the region.",
  traction: "Six hundred farmers onboarded across four districts in eighteen months.",
  impact: "Cuts post-harvest loss for smallholders who currently lose a third of every crop.",
  founderContext: "Built by two agronomists who ran the district cooperative before this.",
  targetRegions: ["US" as const],
  consentToProcess: true as const,
};

const LISTING = {
  publicContext: "Cold chain is the binding constraint on smallholder income in this market.",
  publicStrengths: ["Six hundred farmers onboarded", "District cooperative relationships"],
  publicConsiderations: ["Unit economics unproven above four districts"],
  publicTraction: "600 farmers, four districts, eighteen months.",
};

/** A founder with an organization, a profile and a saved private draft. */
async function seedFounderWithDraft(t: ReturnType<typeof convexTest>, email = "founder@example.org") {
  const founder = await createUser(t, { role: "participant", email });
  const { organizationId } = await founder.as.mutation(createOrganization, {
    name: "Kigali Agritech",
    slug: `kigali-${email.split("@")[0]}`,
  });
  const { startupProfileId } = await founder.as.mutation(createProfile, {
    organizationId,
    ...PROFILE,
  });
  const { listingId } = await founder.as.mutation(saveListing, { startupProfileId, ...LISTING });
  return { founder, organizationId, startupProfileId, listingId };
}

/** An admin whose session has completed TOTP step-up, as `requireAdmin` demands. */
async function seedAdmin(t: ReturnType<typeof convexTest>) {
  const admin = await createUser(t, { role: "admin", email: "operator@example.org" });
  await grantMfa(t, admin.userId, admin.sessionId);
  return admin;
}

describe("catalogue publication lifecycle", () => {
  it("keeps a saved draft private and out of the public catalogue", async () => {
    const t = convexTest(schema, modules);
    const { founder } = await seedFounderWithDraft(t);

    expect(await t.query(listPublished, {})).toHaveLength(0);
    const mine = await founder.as.query(myListing, {});
    expect(mine?.listing?.visibility).toBe("private");
  });

  it("does not publish on submission alone — review is a real gate", async () => {
    const t = convexTest(schema, modules);
    const { founder, listingId } = await seedFounderWithDraft(t);

    await founder.as.mutation(submitForReview, { listingId });

    expect(await t.query(listPublished, {})).toHaveLength(0);
    const mine = await founder.as.query(myListing, {});
    expect(mine?.listing?.visibility).toBe("review");
  });

  it("publishes only once an operator approves, and then it is public", async () => {
    const t = convexTest(schema, modules);
    const { founder, listingId } = await seedFounderWithDraft(t);
    const admin = await seedAdmin(t);

    await founder.as.mutation(submitForReview, { listingId });
    expect(await admin.as.query(reviewQueue, {})).toHaveLength(1);

    await admin.as.mutation(decideListing, { listingId, approve: true });
    expect(await t.query(listPublished, {})).toHaveLength(1);
  });

  it("refuses to publish a draft the founder never submitted", async () => {
    const t = convexTest(schema, modules);
    const { listingId } = await seedFounderWithDraft(t);
    const admin = await seedAdmin(t);

    await expect(admin.as.mutation(decideListing, { listingId, approve: true })).rejects.toThrow(
      "Only a submitted listing can be decided",
    );
  });

  it("refuses review powers to a founder and to an investor", async () => {
    const t = convexTest(schema, modules);
    const { founder, listingId } = await seedFounderWithDraft(t);
    const investor = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });

    await founder.as.mutation(submitForReview, { listingId });

    await expect(founder.as.query(reviewQueue, {})).rejects.toThrow("FORBIDDEN");
    await expect(investor.as.query(reviewQueue, {})).rejects.toThrow("FORBIDDEN");
    await expect(investor.as.mutation(decideListing, { listingId, approve: true })).rejects.toThrow(
      "FORBIDDEN",
    );
  });

  // Otherwise review is decorative: publish once, then rewrite the text freely.
  it("takes a published listing back down when its text is edited", async () => {
    const t = convexTest(schema, modules);
    const { founder, startupProfileId, listingId } = await seedFounderWithDraft(t);
    const admin = await seedAdmin(t);

    await founder.as.mutation(submitForReview, { listingId });
    await admin.as.mutation(decideListing, { listingId, approve: true });
    expect(await t.query(listPublished, {})).toHaveLength(1);

    await founder.as.mutation(saveListing, {
      startupProfileId,
      ...LISTING,
      publicContext: "Rewritten after approval.",
    });

    expect(await t.query(listPublished, {})).toHaveLength(0);
    const mine = await founder.as.query(myListing, {});
    expect(mine?.listing?.visibility).toBe("private");
    expect(mine?.listing).toMatchObject({ approvedAt: null });
  });

  it("lets a founder withdraw a published listing immediately, with no operator involved", async () => {
    const t = convexTest(schema, modules);
    const { founder, listingId } = await seedFounderWithDraft(t);
    const admin = await seedAdmin(t);

    await founder.as.mutation(submitForReview, { listingId });
    await admin.as.mutation(decideListing, { listingId, approve: true });

    await founder.as.mutation(withdraw, { listingId });
    expect(await t.query(listPublished, {})).toHaveLength(0);
  });

  it("sends a rejected listing back to private rather than deleting the founder's work", async () => {
    const t = convexTest(schema, modules);
    const { founder, listingId } = await seedFounderWithDraft(t);
    const admin = await seedAdmin(t);

    await founder.as.mutation(submitForReview, { listingId });
    await admin.as.mutation(decideListing, { listingId, approve: false, reason: "Traction unclear" });

    const mine = await founder.as.query(myListing, {});
    expect(mine?.listing?.visibility).toBe("private");
    expect(mine?.listing).toMatchObject({ publicContext: LISTING.publicContext });
  });
});

describe("the interest loop", () => {
  async function seedPublished(t: ReturnType<typeof convexTest>) {
    const seeded = await seedFounderWithDraft(t);
    const admin = await seedAdmin(t);
    await seeded.founder.as.mutation(submitForReview, { listingId: seeded.listingId });
    await admin.as.mutation(decideListing, { listingId: seeded.listingId, approve: true });
    return seeded;
  }

  it("refuses interest in a listing that is not published", async () => {
    const t = convexTest(schema, modules);
    const { listingId } = await seedFounderWithDraft(t);
    const investor = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });

    await expect(investor.as.mutation(expressInterest, { listingId })).rejects.toThrow(
      "That listing is not available",
    );
  });

  it("records an angel's interest without requiring them to have an organization", async () => {
    const t = convexTest(schema, modules);
    const { listingId } = await seedPublished(t);
    const investor = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });

    expect(await investor.as.mutation(expressInterest, { listingId, note: "Keen." })).toEqual({
      created: true,
    });
    // Expressing interest again updates the note rather than duplicating.
    expect(await investor.as.mutation(expressInterest, { listingId, note: "Still keen." })).toEqual({
      created: false,
    });
    expect(await investor.as.query(myInterests, {})).toHaveLength(1);
  });

  it("delivers the signal to the founder's inbox, withholding the address until they accept", async () => {
    const t = convexTest(schema, modules);
    const { founder, listingId } = await seedPublished(t);
    const investor = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });
    await investor.as.mutation(expressInterest, { listingId, note: "Keen." });

    const before = await founder.as.query(myListingInterests, {});
    expect(before).toHaveLength(1);
    expect(before[0].status).toBe("submitted");
    expect(before[0].investorEmail).toBeNull();

    await founder.as.mutation(respondToInterest, { interestId: before[0].id, accept: true });

    const after = await founder.as.query(myListingInterests, {});
    expect(after[0].status).toBe("accepted");
    expect(after[0].investorEmail).toBe("angel@example.org");
  });

  it("keeps the address withheld when the founder declines", async () => {
    const t = convexTest(schema, modules);
    const { founder, listingId } = await seedPublished(t);
    const investor = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });
    await investor.as.mutation(expressInterest, { listingId });

    const inbox = await founder.as.query(myListingInterests, {});
    await founder.as.mutation(respondToInterest, { interestId: inbox[0].id, accept: false });

    const after = await founder.as.query(myListingInterests, {});
    expect(after[0].status).toBe("declined");
    expect(after[0].investorEmail).toBeNull();
  });

  it("releases the company website to the investor only after acceptance", async () => {
    const t = convexTest(schema, modules);
    const { founder, listingId } = await seedPublished(t);
    const investor = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });
    await investor.as.mutation(expressInterest, { listingId });

    expect((await investor.as.query(myInterests, {}))[0].website).toBeNull();

    const inbox = await founder.as.query(myListingInterests, {});
    await founder.as.mutation(respondToInterest, { interestId: inbox[0].id, accept: true });

    expect((await investor.as.query(myInterests, {}))[0].website).toBe(PROFILE.website);
  });

  // Tenancy: one founder must never see or answer another founder's interest.
  it("keeps one founder's inbox invisible to another", async () => {
    const t = convexTest(schema, modules);
    const { founder, listingId } = await seedPublished(t);
    const investor = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });
    await investor.as.mutation(expressInterest, { listingId });

    const outsider = await createUser(t, { role: "participant", email: "other@example.org" });
    expect(await outsider.as.query(myListingInterests, {})).toHaveLength(0);

    const inbox = await founder.as.query(myListingInterests, {});
    await expect(
      outsider.as.mutation(respondToInterest, { interestId: inbox[0].id, accept: true }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("refuses the founder inbox to an investor and the interest write to a founder", async () => {
    const t = convexTest(schema, modules);
    const { listingId } = await seedPublished(t);
    const investor = await createUser(t, {
      role: "investor",
      email: "angel@example.org",
      investorType: "angel",
    });
    const otherFounder = await createUser(t, { role: "participant", email: "second@example.org" });

    await expect(investor.as.query(myListingInterests, {})).rejects.toThrow("FORBIDDEN");
    await expect(otherFounder.as.mutation(expressInterest, { listingId })).rejects.toThrow("FORBIDDEN");
  });
});
