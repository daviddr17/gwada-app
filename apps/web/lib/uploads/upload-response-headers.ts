/** Verhindert, dass der Browser den Content-Type von Datei-Antworten „errät“. */
export const NOSNIFF_HEADER = {
  "X-Content-Type-Options": "nosniff",
} as const;

/** SVG nur als Bild: kein Script, auch wenn die Datei direkt geöffnet wird. */
export const SVG_DOCUMENT_GUARD_HEADERS = {
  ...NOSNIFF_HEADER,
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
} as const;
