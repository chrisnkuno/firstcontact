"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { defaultLanguage, type LanguageCode } from "@/lib/languages";
import { PUBLIC_ENDPOINTS, convexEndpoint } from "@/lib/convex-endpoints";

type TranslationContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  translate: (text: string) => string;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);
const STORAGE_KEY = "fc-language";
const FLUSH_DELAY_MS = 80;

// Module-level external store for the selected language. localStorage is a
// browser-only, mutable source outside React, so useSyncExternalStore (not
// an effect + setState) is the correct way to hydrate and react to it.
let currentLanguage: LanguageCode = defaultLanguage;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) currentLanguage = stored as LanguageCode;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): LanguageCode {
  ensureHydrated();
  return currentLanguage;
}

function getServerSnapshot(): LanguageCode {
  return defaultLanguage;
}

function setGlobalLanguage(next: LanguageCode) {
  currentLanguage = next;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [cache, setCache] = useState<Map<string, string>>(() => new Map());
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setLanguage = useCallback((next: LanguageCode) => setGlobalLanguage(next), []);

  // Batches every <T>/useT() request made within one short window into a
  // single translate call per language switch, instead of one request
  // per string on the page.
  const flush = useCallback(async (lang: LanguageCode) => {
    const texts = Array.from(pendingRef.current);
    pendingRef.current.clear();
    timerRef.current = null;
    if (!texts.length || lang === "en") return;

    try {
      const endpoint = convexEndpoint(PUBLIC_ENDPOINTS.translate);
      if (!endpoint) return;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts, target: lang }),
      });
      const payload = (await response.json()) as { translations?: string[] };
      if (!Array.isArray(payload.translations)) return;

      setCache((current) => {
        const next = new Map(current);
        texts.forEach((text, index) => {
          const translated = payload.translations?.[index];
          if (translated) next.set(`${lang}:${text}`, translated);
        });
        return next;
      });
    } catch {
      // Originals stay on screen; translate() already falls back to source text.
    }
  }, []);

  const translate = useCallback(
    (text: string) => {
      if (language === "en" || !text.trim()) return text;
      const key = `${language}:${text}`;
      const cached = cache.get(key);
      if (cached) return cached;
      if (!pendingRef.current.has(text)) {
        pendingRef.current.add(text);
        if (!timerRef.current) timerRef.current = setTimeout(() => flush(language), FLUSH_DELAY_MS);
      }
      return text;
    },
    [language, cache, flush],
  );

  const value = useMemo(() => ({ language, setLanguage, translate }), [language, setLanguage, translate]);

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) throw new Error("useTranslation must be used within TranslationProvider");
  return context;
}

// Wraps a plain-text string so it participates in automated translation.
// Usage: <T>Join FirstContact</T>
export function T({ children }: { children: string }) {
  const { translate } = useTranslation();
  return <>{translate(children)}</>;
}
