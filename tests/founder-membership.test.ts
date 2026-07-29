import { describe, expect, it } from "vitest";
import { normalizeAccountEmail, resolveSignupEmail } from "@/lib/founder-membership";

describe("founder status membership", () => {
  it("keeps existing accounts scoped to the signup with the same email", () => {
    expect(resolveSignupEmail(" Shema@Kozi-AI.com ")).toBe("shema@kozi-ai.com");
  });

  it("allows an operator-provisioned member to resolve only to the explicitly linked signup", () => {
    expect(resolveSignupEmail("brian@kozi-ai.com", " Shema@Kozi-AI.com ")).toBe("shema@kozi-ai.com");
  });

  it("normalizes member login identities consistently", () => {
    expect(normalizeAccountEmail(" Brian@Kozi-AI.com ")).toBe("brian@kozi-ai.com");
  });
});
