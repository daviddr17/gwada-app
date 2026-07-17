"use client";

import { NextIntlClientProvider } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppLocale } from "@/i18n/config";
import { isRtlLocale } from "@/i18n/config";
import {
  EMBED_LOCALE_COOKIE,
  EMBED_LOCALE_COOKIE_MAX_AGE_SECONDS,
  EMBED_LOCALE_QUERY_PARAM,
  normalizeEmbedLocale,
} from "@/lib/embed/embed-locale";
import { applyEmbedContentTranslation } from "@/lib/embed/browser-content-translate";

type EmbedLocaleContextValue = {
  sourceLocale: AppLocale;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  contentBusy: boolean;
  messagesReady: boolean;
};

const EmbedLocaleContext = createContext<EmbedLocaleContextValue | null>(null);

export function useEmbedLocale(): EmbedLocaleContextValue {
  const ctx = useContext(EmbedLocaleContext);
  if (!ctx) {
    throw new Error("useEmbedLocale requires EmbedLocaleProvider");
  }
  return ctx;
}

export function useEmbedLocaleOptional(): EmbedLocaleContextValue | null {
  return useContext(EmbedLocaleContext);
}

function readEmbedLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${EMBED_LOCALE_COOKIE}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeEmbedLocaleCookie(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${EMBED_LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${EMBED_LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

const messageImports: Record<
  AppLocale,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  de: () => import("@/messages/de.json"),
  en: () => import("@/messages/en.json"),
  es: () => import("@/messages/es.json"),
  fr: () => import("@/messages/fr.json"),
  it: () => import("@/messages/it.json"),
  tr: () => import("@/messages/tr.json"),
  ar: () => import("@/messages/ar.json"),
  zh: () => import("@/messages/zh.json"),
};

function initialGuestLocale(sourceLocale: AppLocale): AppLocale {
  if (typeof window === "undefined") return sourceLocale;
  const fromQuery = new URLSearchParams(window.location.search).get(
    EMBED_LOCALE_QUERY_PARAM,
  );
  if (fromQuery) return normalizeEmbedLocale(fromQuery);
  const fromCookie = readEmbedLocaleCookie();
  if (fromCookie) return normalizeEmbedLocale(fromCookie);
  return sourceLocale;
}

export function EmbedLocaleProvider({
  sourceLocale,
  children,
}: {
  sourceLocale: AppLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(sourceLocale);
  const [messages, setMessages] = useState<Record<string, unknown> | null>(
    null,
  );
  const [contentBusy, setContentBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const translatingRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocaleState(initialGuestLocale(sourceLocale));
    setHydrated(true);
  }, [sourceLocale]);

  useEffect(() => {
    let cancelled = false;
    void messageImports[locale]().then((mod) => {
      if (!cancelled) setMessages(mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (!hydrated) return;
    writeEmbedLocaleCookie(locale);
    const root = document.getElementById("gwada-embed-root");
    if (root) {
      root.lang = locale;
      root.dir = isRtlLocale(locale) ? "rtl" : "ltr";
    }
  }, [locale, hydrated]);

  const runContentTranslation = useCallback(async () => {
    const root = document.querySelector("[data-gwada-embed-content]");
    if (!root || translatingRef.current) return;

    translatingRef.current = true;
    setContentBusy(true);
    try {
      await applyEmbedContentTranslation({
        root,
        sourceLocale,
        targetLocale: locale,
      });
    } finally {
      translatingRef.current = false;
      setContentBusy(false);
    }
  }, [locale, sourceLocale]);

  useEffect(() => {
    if (!hydrated || !messages) return;
    void runContentTranslation();
  }, [hydrated, messages, runContentTranslation]);

  // Re-run when feed content changes (pagination / filter). Debounced + locked
  // so our own textContent writes do not loop.
  useEffect(() => {
    if (!hydrated || !messages) return;
    const root = document.querySelector("[data-gwada-embed-content]");
    if (!root) return;

    const observer = new MutationObserver(() => {
      if (translatingRef.current) return;
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void runContentTranslation();
      }, 160);
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [hydrated, messages, runContentTranslation]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(normalizeEmbedLocale(next));
  }, []);

  const value = useMemo(
    () => ({
      sourceLocale,
      locale,
      setLocale,
      contentBusy,
      messagesReady: messages != null,
    }),
    [sourceLocale, locale, setLocale, contentBusy, messages],
  );

  if (!messages) {
    return (
      <EmbedLocaleContext.Provider value={value}>
        {children}
      </EmbedLocaleContext.Provider>
    );
  }

  return (
    <EmbedLocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </EmbedLocaleContext.Provider>
  );
}
