"use client";

import { Languages } from "lucide-react";
import { useTranslation } from "@/components/translation-provider";
import { supportedLanguages, type LanguageCode } from "@/lib/languages";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage } = useTranslation();
  return (
    <label className={`language-switcher ${className ?? ""}`.trim()}>
      <Languages size={13} />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        aria-label="Choose language"
      >
        {supportedLanguages.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
