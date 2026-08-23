export const supportedLanguages = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "sw", label: "Swahili", nativeLabel: "Kiswahili" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]["code"];

export const defaultLanguage: LanguageCode = "en";

const supportedLanguageCodes = new Set<string>(supportedLanguages.map((language) => language.code));

export function isLanguageCode(value: string): value is LanguageCode {
  return supportedLanguageCodes.has(value);
}

export function languageDirection(language: LanguageCode): "ltr" | "rtl" {
  return language === "ar" ? "rtl" : "ltr";
}
