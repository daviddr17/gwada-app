import type { ParsedMail } from "mailparser";

const DEFAULT_HTML_MAX_LEN = 200_000;

/** Grobe Bereinigung — Scripts und Inline-Handler entfernen (Anzeige im sandboxed iframe). */
export function sanitizeEmailHtmlForDisplay(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function rawHtmlFromParsedMail(mail: ParsedMail): string | null {
  const html =
    typeof mail.html === "string"
      ? mail.html
      : Array.isArray(mail.html)
        ? mail.html.join("")
        : null;
  const trimmed = html?.trim();
  return trimmed ? trimmed : null;
}

export function bodyHtmlFromParsedMail(
  mail: ParsedMail,
  maxLen = DEFAULT_HTML_MAX_LEN,
): string | null {
  const raw = rawHtmlFromParsedMail(mail);
  if (!raw) return null;
  const cleaned = sanitizeEmailHtmlForDisplay(raw);
  if (!cleaned.trim()) return null;
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

/** Vollständiges iframe-Dokument — Layout/CSS bleibt im iframe isoliert. */
export function buildEmailIframeSrcDoc(html: string): string {
  const safe = sanitizeEmailHtmlForDisplay(html);
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-x: auto;
  }
  *, *::before, *::after { box-sizing: inherit; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #111827;
    background: transparent;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; width: 100%; table-layout: fixed; }
  td, th { word-break: break-word; overflow-wrap: anywhere; }
  pre { white-space: pre-wrap; overflow-x: auto; max-width: 100%; }
  a { color: #2563eb; word-break: break-word; }
</style>
</head>
<body>${safe}</body>
</html>`;
}
