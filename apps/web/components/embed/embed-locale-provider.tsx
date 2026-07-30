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
import {
  applyEmbedContentTranslation,
  EMBED_MT_ATTR,
} from "@/lib/embed/browser-content-translate";

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

  const runContentTranslation = useCallback(
    async (opts?: { silent?: boolean }) => {
      const root = document.querySelector("[data-gwada-embed-content]");
      if (!root || translatingRef.current) return;

      translatingRef.current = true;
      if (!opts?.silent) setContentBusy(true);
      try {
        await applyEmbedContentTranslation({
          root,
          sourceLocale,
          targetLocale: locale,
        });
      } finally {
        translatingRef.current = false;
        if (!opts?.silent) setContentBusy(false);
      }
    },
    [locale, sourceLocale],
  );

  useEffect(() => {
    if (!hydrated || !messages) return;
    void runContentTranslation();
  }, [hydrated, messages, runContentTranslation]);

  // Re-run only when new `[data-embed-mt]` nodes appear (pagination / filter).
  // Text-only swaps (expand, our own writes) must not re-trigger a full batch.
  useEffect(() => {
    if (!hydrated || !messages) return;
    const root = document.querySelector("[data-gwada-embed-content]");
    if (!root) return;

    const hasNewMtNode = (mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as Element;
          if (
            el.hasAttribute(EMBED_MT_ATTR) ||
            el.querySelector(`[${EMBED_MT_ATTR}]`)
          ) {
            return true;
          }
        }
      }
      return false;
    };

    const observer = new MutationObserver((mutations) => {
      if (translatingRef.current) return;
      if (!hasNewMtNode(mutations)) return;
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void runContentTranslation({ silent: true });
      }, 280);
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

  // Wait for the first catalog before mounting children. Switching between
  // "no NextIntl wrapper" and "wrapped" remounted forms (e.g. reservation)
  // and wiped in-flight submits / filled fields.
  if (!messages) {
    return (
      <EmbedLocaleContext.Provider value={value}>
        <div className="min-h-[12rem] w-full" aria-busy="true" />
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
