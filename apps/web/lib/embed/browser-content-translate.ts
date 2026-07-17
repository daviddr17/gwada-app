"use client";

import type { AppLocale } from "@/i18n/config";

const ORIGINAL_ATTR = "data-embed-mt-original";
export const EMBED_MT_ATTR = "data-embed-mt";

type TranslatorLike = {
  translate: (text: string) => Promise<string>;
  destroy?: () => void;
};

type TranslatorCtor = {
  availability: (opts: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  create: (opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }) => Promise<TranslatorLike>;
};

function getTranslatorCtor(): TranslatorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { Translator?: TranslatorCtor };
  return w.Translator ?? null;
}

async function translateWithChromeApi(
  texts: string[],
  source: AppLocale,
  target: AppLocale,
): Promise<string[] | null> {
  const Translator = getTranslatorCtor();
  if (!Translator) return null;

  try {
    const availability = await Translator.availability({
      sourceLanguage: source,
      targetLanguage: target,
    });
    if (availability === "unavailable") return null;

    const translator = await Translator.create({
      sourceLanguage: source,
      targetLanguage: target,
    });
    const out: string[] = [];
    for (const text of texts) {
      out.push(text.trim() ? await translator.translate(text) : text);
    }
    translator.destroy?.();
    return out;
  } catch {
    return null;
  }
}

/** Free proxy fallback (no Cloud Translation API key, nothing stored). */
async function translateWithProxy(
  texts: string[],
  source: AppLocale,
  target: AppLocale,
): Promise<string[] | null> {
  try {
    const res = await fetch("/api/public/embed/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, source, target }),
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { translations?: string[] };
    if (!Array.isArray(body.translations)) return null;
    if (body.translations.length !== texts.length) return null;
    return body.translations;
  } catch {
    return null;
  }
}

export async function translateTextBatch(
  texts: string[],
  source: AppLocale,
  target: AppLocale,
): Promise<string[] | null> {
  if (source === target) return texts;
  if (texts.length === 0) return texts;

  const viaChrome = await translateWithChromeApi(texts, source, target);
  if (viaChrome) return viaChrome;

  return translateWithProxy(texts, source, target);
}

/**
 * Translate (or restore) all `[data-embed-mt]` nodes under `root`.
 * Original text is kept in `data-embed-mt-original`.
 */
export async function applyEmbedContentTranslation(params: {
  root: ParentNode;
  sourceLocale: AppLocale;
  targetLocale: AppLocale;
}): Promise<"idle" | "translated" | "restored" | "failed"> {
  const { root, sourceLocale, targetLocale } = params;
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(`[${EMBED_MT_ATTR}]`),
  );
  if (nodes.length === 0) return "idle";

  if (targetLocale === sourceLocale) {
    for (const node of nodes) {
      const original = node.getAttribute(ORIGINAL_ATTR);
      if (original != null) node.textContent = original;
    }
    return "restored";
  }

  const payloads = nodes.map((node) => {
    const original = node.getAttribute(ORIGINAL_ATTR);
    if (original == null) {
      const text = node.textContent ?? "";
      node.setAttribute(ORIGINAL_ATTR, text);
      return text;
    }
    return original;
  });

  const unique: string[] = [];
  const indexMap: number[] = [];
  const seen = new Map<string, number>();
  for (const text of payloads) {
    const key = text;
    const existing = seen.get(key);
    if (existing != null) {
      indexMap.push(existing);
      continue;
    }
    const idx = unique.length;
    seen.set(key, idx);
    unique.push(key);
    indexMap.push(idx);
  }

  const translatedUnique = await translateTextBatch(
    unique,
    sourceLocale,
    targetLocale,
  );
  if (!translatedUnique) return "failed";

  nodes.forEach((node, i) => {
    const mapped = translatedUnique[indexMap[i] ?? 0];
    if (typeof mapped === "string") node.textContent = mapped;
  });

  return "translated";
}
