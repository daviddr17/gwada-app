/** Deutsche Zahlwörter für Sprach-Parsing (1–12). */
export const GERMAN_NUMBER_WORDS: Record<string, number> = {
  eins: 1,
  eine: 1,
  ein: 1,
  zwei: 2,
  zwo: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  zwoelf: 12,
};

const WORD_ALT = Object.keys(GERMAN_NUMBER_WORDS).join("|");

const QTY_TOKEN_RE = new RegExp(`^(\\d+(?:[.,]\\d+)?|${WORD_ALT})$`, "i");

export function parseGermanQuantityToken(raw: string): number | null {
  const token = raw.trim().toLowerCase();
  if (!token) return null;
  if (/^\d+(?:[.,]\d+)?$/.test(token)) {
    const n = Number.parseFloat(token.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const fromWord = GERMAN_NUMBER_WORDS[token];
  return fromWord != null && fromWord > 0 ? fromWord : null;
}

export function isQuantityToken(raw: string): boolean {
  return QTY_TOKEN_RE.test(raw.trim());
}
