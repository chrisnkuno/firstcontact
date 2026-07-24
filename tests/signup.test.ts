import { describe, expect, it } from "vitest";
import { interestSignupSchema, normalizeSignupWebsite } from "@/lib/domain";

const common = {
  name: "Amina N.",
  email: "AMINA@example.org",
  location: "Kigali, Rwanda",
  summary: "I am building better access to distributed energy infrastructure.",
  context: "Regional procurement cycles and local financing structures shape how customers adopt.",
  goals: ["raise-capital"] as const,
  targetRegions: ["US", "EU"] as const,
  referralSource: "community" as const,
  consentToProcess: true as const,
  productUpdates: false,
};

describe("interest signup", () => {
  it("accepts and normalizes a complete startup signup", () => {
    const parsed = interestSignupSchema.parse({
      ...common,
      accountType: "startup",
      organizationName: "Kivu Grid",
      website: "",
      stage: "seed",
    });

    expect(parsed.email).toBe("amina@example.org");
    expect(parsed.website).toBeUndefined();
  });

  it("requires an organization name for institutions", () => {
    const result = interestSignupSchema.safeParse({
      ...common,
      accountType: "institution",
      goals: ["partner"],
    });

    expect(result.success).toBe(false);
  });

  it("requires a role for individuals", () => {
    const result = interestSignupSchema.safeParse({
      ...common,
      accountType: "individual",
      goals: ["invest"],
    });

    expect(result.success).toBe(false);
  });

  it("accepts an individual without organization details", () => {
    const result = interestSignupSchema.safeParse({
      ...common,
      accountType: "individual",
      individualRole: "investor",
      goals: ["invest", "mentor"],
    });

    expect(result.success).toBe(true);
  });

  it("normalizes a website without forcing the user to type a scheme", () => {
    expect(normalizeSignupWebsite(" kivu.example/path ")).toBe(
      "https://kivu.example/path",
    );
  });

  it("rejects non-web URL schemes", () => {
    const result = interestSignupSchema.safeParse({
      ...common,
      accountType: "startup",
      organizationName: "Kivu Grid",
      website: "javascript:alert(1)",
      stage: "seed",
    });

    expect(result.success).toBe(false);
  });

  it("accepts every listed participation goal", () => {
    const result = interestSignupSchema.safeParse({
      ...common,
      accountType: "startup",
      organizationName: "Kivu Grid",
      stage: "seed",
      goals: [
        "raise-capital",
        "find-investors",
        "join-catalogue",
        "mentor",
        "partner",
        "research",
        "invest",
      ],
    });

    expect(result.success).toBe(true);
  });
});
