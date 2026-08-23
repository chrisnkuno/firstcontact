import { describe, expect, it } from "vitest";
import {
  isLanguageCode,
  languageDirection,
  supportedLanguages,
} from "@/lib/languages";

describe("supported languages", () => {
  it("keeps every promised language in the selector source", () => {
    expect(supportedLanguages.map((language) => language.code)).toEqual([
      "en",
      "fr",
      "es",
      "pt",
      "sw",
      "ar",
      "bn",
    ]);
    expect(new Set(supportedLanguages.map((language) => language.code)).size).toBe(
      supportedLanguages.length,
    );
    expect(supportedLanguages.every((language) => language.nativeLabel.trim().length > 0)).toBe(true);
  });

  it("rejects stale stored values and applies RTL only to Arabic", () => {
    expect(isLanguageCode("sw")).toBe(true);
    expect(isLanguageCode("unknown")).toBe(false);
    expect(languageDirection("ar")).toBe("rtl");
    expect(languageDirection("bn")).toBe("ltr");
  });
});
