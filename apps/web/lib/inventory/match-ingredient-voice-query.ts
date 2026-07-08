import type { Ingredient } from "@/lib/types/inventory";
import { FUZZY_MATCH_THRESHOLD } from "@/lib/utils/fuzzy-search";

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

function similarityScore(text: string, query: string): number {
  const t = normalize(text);
  const q = normalize(query);
  if (!q) return 0;
  if (t === q) return 1;
  if (t.includes(q)) return 0.95;
  if (q.includes(t) && t.length >= 3) return 0.9;

  const ratio = 1 - levenshtein(t, q) / Math.max(t.length, q.length, 1);
  if (ratio >= FUZZY_MATCH_THRESHOLD) return ratio;

  let bestWord = 0;
  for (const w of t.split(" ")) {
    if (w.length < 2) continue;
    const wr = 1 - levenshtein(w, q) / Math.max(w.length, q.length, 1);
    bestWord = Math.max(bestWord, wr);
  }
  return bestWord;
}

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

  const scored = active
    .map((ingredient) => ({
      ingredient,
      score: similarityScore(ingredient.name, query),
    }))
    .filter((row) => row.score >= FUZZY_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      ok: false,
      error: `Keine Zutat für „${query}" gefunden.`,
    };
  }

  const best = scored[0]!;
  const second = scored[1];
  if (second && second.score >= best.score - 0.05 && second.score >= FUZZY_MATCH_THRESHOLD) {
    return {
      ok: false,
      error: `„${query}" ist mehrdeutig (${best.ingredient.name} oder ${second.ingredient.name}). Bitte genauer benennen.`,
    };
  }

  return { ok: true, ingredient: best.ingredient };
}
