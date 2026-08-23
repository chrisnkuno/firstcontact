import { describe, expect, it } from "vitest";
import { maskParticipantLabel, privacyJurisdictions, privacyRequestKinds, privacyRequestSchema } from "../lib/domain";

describe("privacy request policy", () => {
  it("covers every product capital region and an explicit fallback", () => {
    expect(privacyJurisdictions).toEqual(["US", "UK", "EU", "APAC", "OTHER"]);
  });

  it("supports the core rights workflow", () => {
    expect(privacyRequestKinds).toEqual([
      "access", "correction", "deletion", "restriction", "objection", "appeal",
    ]);
  });

  it("rejects oversized or unknown requests", () => {
    expect(privacyRequestSchema.safeParse({ kind: "sale", jurisdiction: "US", details: "" }).success).toBe(false);
    expect(privacyRequestSchema.safeParse({ kind: "access", jurisdiction: "EU", details: "x".repeat(2001) }).success).toBe(false);
  });

  it("does not publish full participant identities in the login chooser", () => {
    expect(maskParticipantLabel("Test Person")).toBe("T••• P•••");
    expect(maskParticipantLabel("Kivu Grid")).not.toContain("Kivu");
  });
});
