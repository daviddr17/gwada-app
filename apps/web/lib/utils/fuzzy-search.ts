/** Mindest-Ähnlichkeit (ca. 80 %) für Treffer neben exakter Teilstring-Suche. */
export const FUZZY_MATCH_THRESHOLD = 0.8;

/** Fuzzy erst ab dieser Query-Länge — darunter nur exakter Teilstring. */
export const FUZZY_MIN_QUERY_LENGTH = 3;

/** Haystack-Cap für Fuzzy (weniger CPU bei langen Texten). */
const FUZZY_TEXT_SCAN_LIMIT = 96;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Früher Abbruch: bei großem Längenunterschied kein Fuzzy-Treffer möglich.
  if (Math.abs(m - n) / Math.max(m, n, 1) > 1 - FUZZY_MATCH_THRESHOLD) {
    return Math.max(m, n);
  }
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n]!;
}

function similarityRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}

function fuzzySingleTokenMatches(
  textNorm: string,
  queryNorm: string,
  threshold: number,
): boolean {
  if (!queryNorm) return true;
  if (textNorm.includes(queryNorm)) return true;

  const tScan =
    textNorm.length > FUZZY_TEXT_SCAN_LIMIT
      ? textNorm.slice(0, FUZZY_TEXT_SCAN_LIMIT)
      : textNorm;

  if (similarityRatio(tScan, queryNorm) >= threshold) return true;

  for (const w of tScan.split(" ")) {
    if (w.length < 2) continue;
    // Nur Wörter ähnlicher Länge vergleichen — spart Levenshtein.
    if (Math.abs(w.length - queryNorm.length) > 2) continue;
    if (similarityRatio(w, queryNorm) >= threshold) return true;
  }

  // Fenster-Scan nur bei kurzen Queries/Texten; sonst zu teuer.
  if (queryNorm.length > 16 || tScan.length > 64) return false;

  const maxWindow = Math.min(tScan.length, queryNorm.length + 2);
  const minWindow = Math.max(2, queryNorm.length - 1);
  for (let len = minWindow; len <= maxWindow; len++) {
    for (let i = 0; i + len <= tScan.length; i++) {
      const sub = tScan.slice(i, i + len);
      if (similarityRatio(sub, queryNorm) >= threshold) return true;
    }
  }

  return false;
}

export function queryAllowsFuzzy(query: string): boolean {
  const q = normalize(query);
  if (q.length >= FUZZY_MIN_QUERY_LENGTH) return true;
  return q.split(" ").some((token) => token.length >= FUZZY_MIN_QUERY_LENGTH);
}

/**
 * Treffer, wenn Teilstring vorkommt oder (ab 3 Zeichen) Ähnlichkeit ≥ Schwellwert.
 * Mehrwort-Queries: jedes Wort muss gegen den Text matchen (Tippfehler ok).
 */
export function fuzzyTextMatchesQuery(
  text: string,
  query: string,
  threshold = FUZZY_MATCH_THRESHOLD,
): boolean {
  const t = normalize(text);
  const q = normalize(query);
  if (!q) return true;
  if (t.includes(q)) return true;

  const tokens = q.split(" ").filter((token) => token.length > 0);
  if (tokens.length > 1 && tokens.every((token) => t.includes(token))) {
    return true;
  }

  if (!queryAllowsFuzzy(query)) return false;

  if (fuzzySingleTokenMatches(t, q, threshold)) return true;
  if (tokens.length > 1) {
    return tokens.every((token) => fuzzySingleTokenMatches(t, token, threshold));
  }

  return false;
}

/** Exakter Teilstring (normalisiert), ohne Fuzzy — für Ranking. */
export function textIncludesQueryExact(text: string, query: string): boolean {
  const t = normalize(text);
  const q = normalize(query);
  if (!q) return true;
  if (t.includes(q)) return true;
  const tokens = q.split(" ").filter((token) => token.length > 0);
  if (tokens.length <= 1) return false;
  return tokens.every((token) => t.includes(token));
}
