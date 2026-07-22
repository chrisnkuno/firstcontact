import { describe, expect, it } from "vitest";
import { evaluateContactPolicy, normalizeEmail } from "@/lib/compliance";

const safe = { outboundEnabled: true, approved: true, hasSource: true, isSuppressed: false, contactType: "generic_business" as const, jurisdictionReviewed: true, hasPostalIdentity: true, hasUnsubscribe: true };

describe("outbound policy", () => {
  it("allows a fully reviewed generic business contact", () => expect(evaluateContactPolicy(safe)).toEqual({ allowed: true, reasons: [] }));
  it("fails closed when outbound is disabled", () => expect(evaluateContactPolicy({ ...safe, outboundEnabled: false }).allowed).toBe(false));
  it("always blocks suppressed recipients", () => expect(evaluateContactPolicy({ ...safe, isSuppressed: true }).reasons).toContain("The recipient is on the suppression list"));
  it("requires legal review for named business contacts", () => expect(evaluateContactPolicy({ ...safe, contactType: "named_business", jurisdictionReviewed: false }).allowed).toBe(false));
  it("normalizes emails before suppression hashing", () => expect(normalizeEmail("  Founder@Example.COM ")).toBe("founder@example.com"));
});
