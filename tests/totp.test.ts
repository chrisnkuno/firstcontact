import { describe, expect, it } from "vitest";
import { buildOtpauthUri, generateTotpSecret, totpCode, verifyTotp } from "@/lib/totp";

describe("totp", () => {
  it("generates a base32 secret using only the RFC 4648 alphabet", async () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(0);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it("produces a stable 6-digit code for a given secret and time step", async () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const codeA = await totpCode(secret, now);
    const codeB = await totpCode(secret, now);
    expect(codeA).toBe(codeB);
    expect(/^\d{6}$/.test(codeA)).toBe(true);
  });

  it("verifies a freshly generated code", async () => {
    const secret = generateTotpSecret();
    const code = await totpCode(secret);
    expect(await verifyTotp(secret, code)).toBe(true);
  });

  it("tolerates one step of clock drift in either direction", async () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const previousStepCode = await totpCode(secret, now - 30_000);
    const nextStepCode = await totpCode(secret, now - 30_000 + 60_000);
    expect(await verifyTotp(secret, previousStepCode, now)).toBe(true);
    expect(await verifyTotp(secret, nextStepCode, now)).toBe(true);
  });

  it("rejects a code far outside the allowed drift window", async () => {
    const secret = generateTotpSecret();
    const staleCode = await totpCode(secret, Date.now() - 10 * 60_000);
    expect(await verifyTotp(secret, staleCode)).toBe(false);
  });

  it("rejects a code generated from a different secret", async () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const codeFromB = await totpCode(secretB);
    expect(await verifyTotp(secretA, codeFromB)).toBe(false);
  });

  it("rejects malformed input instead of throwing", async () => {
    const secret = generateTotpSecret();
    expect(await verifyTotp(secret, "not-a-code")).toBe(false);
    expect(await verifyTotp(secret, "12345")).toBe(false);
  });

  it("builds a well-formed otpauth:// URI", async () => {
    const uri = buildOtpauthUri({ secret: "JBSWY3DPEHPK3PXP", email: "admin@example.com", issuer: "FirstContact" });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=FirstContact");
    expect(uri).toContain(encodeURIComponent("FirstContact:admin@example.com"));
  });
});
