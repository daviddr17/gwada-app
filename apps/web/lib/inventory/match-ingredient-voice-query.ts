import type { Ingredient } from "@/lib/types/inventory";

/** Mindest-Score, um als Kandidat zu gelten (katalogbasiert, nicht nur exakter String). */
const MIN_CANDIDATE_SCORE = 0.48;

/** Zweiter Kandidat innerhalb dieser Spanne → Auswahl-Dialog. */
const AMBIGUOUS_SCORE_GAP = 0.12;

/** Ab dieser Lücke zum Zweiten gilt der Treffer als eindeutig. */
const MIN_CLEAR_WIN_GAP = 0.14;

export type IngredientVoiceMatchCandidate = {
  ingredient: Ingredient;
  score: number;
};

export type IngredientVoiceMatchResult =
  | { status: "matched"; ingredient: Ingredient }
  | {
      status: "ambiguous";
      query: string;
      candidates: IngredientVoiceMatchCandidate[];
    }
  | { status: "unmatched"; query: string; suggestions: IngredientVoiceMatchCandidate[] };

function normalizeVoiceToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
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

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i++;
  return i;
}

/** Varianten für häufige STT-Fehler (Plural, Partizip, ausklingende Silben). */
export function speechArticleQueryVariants(query: string): string[] {
  const base = normalizeVoiceToken(query);
  if (!base) return [];

  const variants = new Set<string>([base]);
  const compact = base.replace(/\s/g, "");
  if (compact) variants.add(compact);

  for (const suffix of ["hende", "ende", "enden", "chen", "lein", "en", "er", "e"]) {
    if (base.length > suffix.length + 3 && base.endsWith(suffix)) {
      variants.add(base.slice(0, -suffix.length).trim());
      const c = base.slice(0, -suffix.length).replace(/\s/g, "");
      if (c.length >= 3) variants.add(c);
    }
  }

  return [...variants].filter((v) => v.length >= 2);
}

export function scoreVoiceIngredientMatch(
  ingredientName: string,
  query: string,
): number {
  const name = normalizeVoiceToken(ingredientName);
  const q = normalizeVoiceToken(query);
  if (!q || !name) return 0;

  if (name === q) return 1;
  if (name.replace(/\s/g, "") === q.replace(/\s/g, "")) return 0.98;

  if (q.startsWith(name) && name.length >= 3) {
    return 0.72 + 0.28 * (name.length / q.length);
  }
  if (name.startsWith(q) && q.length >= 3) {
    return 0.68 + 0.28 * (q.length / name.length);
  }

  if (q.includes(name) && name.length >= 4) {
    return 0.52 + 0.38 * (name.length / q.length);
  }
  if (name.includes(q) && q.length >= 4) {
    return 0.52 + 0.38 * (q.length / name.length);
  }

  const ratio = similarityRatio(name, q);
  const prefixLen = commonPrefixLength(name, q);
  const prefixBoost = prefixLen >= 3 ? Math.min(0.16, prefixLen * 0.045) : 0;

  return Math.min(1, ratio + prefixBoost);
}

export function rankIngredientVoiceMatches(
  query: string,
  ingredients: Ingredient[],
  minScore = MIN_CANDIDATE_SCORE,
): IngredientVoiceMatchCandidate[] {
  const active = ingredients.filter((i) => i.active !== false);
  const variants = speechArticleQueryVariants(query);

  return active
    .map((ingredient) => {
      let best = 0;
      for (const variant of variants) {
        best = Math.max(best, scoreVoiceIngredientMatch(ingredient.name, variant));
      }
      return { ingredient, score: best };
    })
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score || a.ingredient.name.localeCompare(b.ingredient.name));
}

function rankIngredientVoiceSuggestions(
  query: string,
  ingredients: Ingredient[],
): IngredientVoiceMatchCandidate[] {
  return rankIngredientVoiceMatches(query, ingredients, 0.35).slice(0, 3);
}

export function resolveIngredientVoiceMatch(
  query: string,
  ingredients: Ingredient[],
): IngredientVoiceMatchResult {
  const ranked = rankIngredientVoiceMatches(query, ingredients);
  if (ranked.length === 0) {
    return {
      status: "unmatched",
      query,
      suggestions: rankIngredientVoiceSuggestions(query, ingredients),
    };
  }

  const best = ranked[0]!;
  const second = ranked[1];
  const close = ranked.filter((row) => row.score >= best.score - AMBIGUOUS_SCORE_GAP);

  if (close.length === 1) {
    return { status: "matched", ingredient: best.ingredient };
  }

  if (second && best.score - second.score >= MIN_CLEAR_WIN_GAP) {
    return { status: "matched", ingredient: best.ingredient };
  }

  return {
    status: "ambiguous",
    query,
    candidates: close.slice(0, 4),
  };
}

/** Probiert mehrere STT-Varianten (Haupttext + Alternativen) nacheinander. */
export function resolveIngredientVoiceMatchWithQueries(
  queries: string[],
  ingredients: Ingredient[],
): IngredientVoiceMatchResult {
  const seen = new Set<string>();
  let lastUnmatched: IngredientVoiceMatchResult = {
    status: "unmatched",
    query: queries[0] ?? "",
    suggestions: [],
  };

  for (const raw of queries) {
    const q = raw.trim();
    if (!q || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());

    const result = resolveIngredientVoiceMatch(q, ingredients);
    if (result.status === "matched" || result.status === "ambiguous") {
      return result;
    }
    lastUnmatched = result;
  }

  return lastUnmatched;
}

/** @deprecated Nutze resolveIngredientVoiceMatch — bleibt für einfache Aufrufer. */
export type MatchIngredientVoiceResult =
  | { ok: true; ingredient: Ingredient }
  | { ok: false; error: string };

export function matchIngredientFromVoiceQuery(
  query: string,
  ingredients: Ingredient[],
): MatchIngredientVoiceResult {
  const active = ingredients.filter((i) => i.active !== false);
  if (active.length === 0) {
    return { ok: false, error: "Keine Zutaten in der Speisekarte vorhanden." };
  }

  const result = resolveIngredientVoiceMatch(query, active);
  if (result.status === "matched") {
    return { ok: true, ingredient: result.ingredient };
  }
  if (result.status === "ambiguous") {
    const labels = result.candidates.map((c) => c.ingredient.name).join(" oder ");
    return {
      ok: false,
      error: `„${query}" ist mehrdeutig (${labels}).`,
    };
  }

  const hint =
    result.suggestions.length > 0
      ? ` Meintest du „${result.suggestions[0]!.ingredient.name}"?`
      : "";
  return {
    ok: false,
    error: `Keine Zutat für „${query}" gefunden.${hint}`,
  };
}
