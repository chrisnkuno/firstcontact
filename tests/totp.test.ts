import { describe, expect, it } from "vitest";
import { buildOtpauthUri, generateTotpSecret, totpCode, verifyTotp } from "@/lib/totp";

describe("totp", () => {
  it("generates a base32 secret using only the RFC 4648 alphabet", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(0);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it("produces a stable 6-digit code for a given secret and time step", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const codeA = totpCode(secret, now);
    const codeB = totpCode(secret, now);
    expect(codeA).toBe(codeB);
    expect(/^\d{6}$/.test(codeA)).toBe(true);
  });

  it("verifies a freshly generated code", () => {
    const secret = generateTotpSecret();
    const code = totpCode(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it("tolerates one step of clock drift in either direction", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const previousStepCode = totpCode(secret, now - 30_000);
    const nextStepCode = totpCode(secret, now - 30_000 + 60_000);
    expect(verifyTotp(secret, previousStepCode, now)).toBe(true);
    expect(verifyTotp(secret, nextStepCode, now)).toBe(true);
  });

  it("rejects a code far outside the allowed drift window", () => {
    const secret = generateTotpSecret();
    const staleCode = totpCode(secret, Date.now() - 10 * 60_000);
    expect(verifyTotp(secret, staleCode)).toBe(false);
  });

  it("rejects a code generated from a different secret", () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const codeFromB = totpCode(secretB);
    expect(verifyTotp(secretA, codeFromB)).toBe(false);
  });

  it("rejects malformed input instead of throwing", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "not-a-code")).toBe(false);
    expect(verifyTotp(secret, "12345")).toBe(false);
  });

  it("builds a well-formed otpauth:// URI", () => {
    const uri = buildOtpauthUri({ secret: "JBSWY3DPEHPK3PXP", email: "admin@example.com", issuer: "FirstContact" });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=FirstContact");
    expect(uri).toContain(encodeURIComponent("FirstContact:admin@example.com"));
  });
});
