import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_LENGTH,
  generateInviteCode,
  normaliseInviteCode,
} from "../lib/invite-code";

/**
 * The code format.
 *
 * These pin the transcription properties, because they are the whole reason
 * the format is not just random base64: a code is passed between people by
 * hand, and a character set that survives that is the difference between the
 * feature working and a support burden.
 */
describe("invite codes", () => {
  const fixedBytes = (length: number) =>
    Uint8Array.from({ length }, (_, index) => index * 7);

  it("formats as a prefixed, hyphen-grouped code", () => {
    expect(generateInviteCode(fixedBytes)).toMatch(/^FC-[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  });

  it("is deterministic for a given randomness source", () => {
    expect(generateInviteCode(fixedBytes)).toBe(generateInviteCode(fixedBytes));
  });

  it("never emits characters that are misread for one another", () => {
    // Sampled across the byte space rather than one fixed vector, so a change
    // to the alphabet cannot slip through on a lucky offset.
    for (let offset = 0; offset < 256; offset += 1) {
      const code = generateInviteCode((length) =>
        Uint8Array.from({ length }, (_, index) => (offset + index) % 256),
      );
      expect(code.slice(3)).not.toMatch(/[ILOU01]/);
    }
  });

  it("accepts any casing and spacing on the way back in", () => {
    const code = generateInviteCode(fixedBytes);
    const mangled = code.toLowerCase().replace(/-/g, " ");
    expect(normaliseInviteCode(mangled)).toBe(code);
    expect(normaliseInviteCode(` ${code} `)).toBe(code);
  });

  it("rejects anything that is not a code", () => {
    expect(normaliseInviteCode("")).toBeNull();
    expect(normaliseInviteCode("hello")).toBeNull();
    // Right shape, wrong prefix.
    expect(normaliseInviteCode("XX-23456-23456")).toBeNull();
    // Right prefix, wrong length.
    expect(normaliseInviteCode("FC-2345-2345")).toBeNull();
    // Right length, but contains an excluded character.
    expect(normaliseInviteCode("FC-IIIII-IIIII")).toBeNull();
  });

  it("uses the full code length it advertises", () => {
    const code = generateInviteCode(fixedBytes);
    expect(code.replace(/[^A-Z0-9]/g, "").slice(2)).toHaveLength(INVITE_CODE_LENGTH);
  });

});
