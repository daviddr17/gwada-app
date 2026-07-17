import { NextResponse } from "next/server";
import {
  isAppLocale,
  normalizeAppLocale,
  type AppLocale,
} from "@/i18n/config";

export const dynamic = "force-dynamic";

const MAX_TEXTS = 40;
const MAX_CHARS = 4500;

async function translateOne(
  text: string,
  source: AppLocale,
  target: AppLocale,
): Promise<string> {
  if (!text.trim()) return text;
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
  if (!res.ok) {
    throw new Error(`translate_http_${res.status}`);
  }
  const data = (await res.json()) as unknown;
  // Response shape: [ [ [translated, original, ...], ... ], ... ]
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("translate_shape");
  }
  const chunks = data[0] as unknown[];
  let out = "";
  for (const chunk of chunks) {
    if (Array.isArray(chunk) && typeof chunk[0] === "string") {
      out += chunk[0];
    }
  }
  return out || text;
}

export async function POST(req: Request) {
  let body: { texts?: unknown; source?: unknown; target?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.texts) || body.texts.length === 0) {
    return NextResponse.json({ error: "texts_required" }, { status: 400 });
  }
  if (body.texts.length > MAX_TEXTS) {
    return NextResponse.json({ error: "too_many_texts" }, { status: 400 });
  }

  const texts = body.texts.map((t) => (typeof t === "string" ? t : ""));
  const totalChars = texts.reduce((n, t) => n + t.length, 0);
  if (totalChars > MAX_CHARS) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const sourceRaw = typeof body.source === "string" ? body.source : "";
  const targetRaw = typeof body.target === "string" ? body.target : "";
  if (!sourceRaw.trim() || !targetRaw.trim()) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }
  const source = normalizeAppLocale(sourceRaw);
  const target = normalizeAppLocale(targetRaw);
  if (!isAppLocale(source) || !isAppLocale(target)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  if (source === target) {
    return NextResponse.json({ translations: texts });
  }

  try {
    const translations: string[] = [];
    for (const text of texts) {
      translations.push(await translateOne(text, source, target));
    }
    return NextResponse.json({ translations });
  } catch (e) {
    const message = e instanceof Error ? e.message : "translate_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
