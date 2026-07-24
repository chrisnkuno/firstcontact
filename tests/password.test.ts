import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword", () => {
  it("produces a parseable scrypt record", () => {
    const stored = hashPassword("correct horse battery staple");
    const [scheme, salt, derived] = stored.split(":");
    expect(scheme).toBe("scrypt");
    expect(salt).toMatch(/^[0-9a-f]{32}$/); // 16 random bytes
    expect(derived).toMatch(/^[0-9a-f]{128}$/); // 64-byte derived key
  });

  it("salts every hash, so identical passwords never collide at rest", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
    // Both must still verify — the difference is salt, not a broken derivation.
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
  });

  it("never stores the password itself", () => {
    const password = "a-very-distinctive-passphrase";
    expect(hashPassword(password)).not.toContain(password);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password and rejects near misses", () => {
    const stored = hashPassword("Tr0ub4dor&3");
    expect(verifyPassword("Tr0ub4dor&3", stored)).toBe(true);
    expect(verifyPassword("Tr0ub4dor&4", stored)).toBe(false);
    expect(verifyPassword("tr0ub4dor&3", stored)).toBe(false); // case matters
    expect(verifyPassword("Tr0ub4dor&3 ", stored)).toBe(false); // no trimming
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("handles unicode and long passphrases without truncating", () => {
    const long = "ときどき-".repeat(20);
    const stored = hashPassword(long);
    expect(verifyPassword(long, stored)).toBe(true);
    expect(verifyPassword(long.slice(0, -1), stored)).toBe(false);
  });

  // A malformed row must fail closed, not throw — an exception here would turn
  // one corrupt record into a 500 on the login route instead of a clean denial.
  it("returns false rather than throwing on a malformed stored value", () => {
    const cases = [
      "",
      "not-a-hash",
      "scrypt:onlytwo",
      "scrypt:abc:def:extra",
      "bcrypt:abcdef:0123456789",
      "scrypt::",
      "scrypt:abcdef:zzzz",
    ];
    for (const stored of cases) {
      expect(() => verifyPassword("anything", stored), stored).not.toThrow();
      expect(verifyPassword("anything", stored), stored).toBe(false);
    }
  });

  it("rejects a record whose derived key is the wrong length", () => {
    const stored = hashPassword("password");
    const [scheme, salt, derived] = stored.split(":");
    expect(verifyPassword("password", `${scheme}:${salt}:${derived.slice(0, 64)}`)).toBe(false);
  });

  it("rejects a record whose salt has been tampered with", () => {
    const stored = hashPassword("password");
    const [scheme, salt, derived] = stored.split(":");
    const tampered = salt.startsWith("0") ? `1${salt.slice(1)}` : `0${salt.slice(1)}`;
    expect(verifyPassword("password", `${scheme}:${tampered}:${derived}`)).toBe(false);
  });
});
