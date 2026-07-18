import "server-only";

import {
  isAppLocale,
  normalizeAppLocale,
  type AppLocale,
} from "@/i18n/config";
import { PLATFORM_NEWSLETTER_SOURCE_LOCALE } from "@/lib/newsletter/newsletter-constants";

async function translateOne(
  text: string,
  source: AppLocale,
  target: AppLocale,
): Promise<string> {
  if (!text.trim() || source === target) return text;
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", source);
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`translate_http_${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("translate_shape");
  }
  let out = "";
  for (const chunk of data[0] as unknown[]) {
    if (Array.isArray(chunk) && typeof chunk[0] === "string") {
      out += chunk[0];
    }
  }
  return out || text;
}

export async function translateNewsletterTexts(params: {
  texts: string[];
  targetLocale: string;
  sourceLocale?: AppLocale;
}): Promise<string[]> {
  const source = params.sourceLocale ?? PLATFORM_NEWSLETTER_SOURCE_LOCALE;
  const target = normalizeAppLocale(params.targetLocale);
  if (!isAppLocale(target) || source === target) {
    return params.texts;
  }
  const out: string[] = [];
  for (const text of params.texts) {
    try {
      out.push(await translateOne(text, source, target));
    } catch {
      out.push(text);
    }
  }
  return out;
}
