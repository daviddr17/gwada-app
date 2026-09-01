import type { IngredientStockLogEntry } from "@/lib/types/ingredient-stock-log";
import type { Ingredient } from "@/lib/types/inventory";

function lastLogAt(stockLog: readonly IngredientStockLogEntry[]): string | null {
  if (stockLog.length === 0) return null;
  return stockLog[stockLog.length - 1]?.at ?? null;
}

/**
 * Merges a client-side ingredient snapshot with current DB rows before
 * `inventory_replace_ingredients` (full delete + insert).
 *
 * Prevents stale client caches from dropping ingredients or stock-log entries
 * when another session already applied stock changes.
 */
export function mergeIngredientsForReplace(
  dbIngredients: readonly Ingredient[],
  clientIngredients: readonly Ingredient[],
): Ingredient[] {
  const clientById = new Map(clientIngredients.map((ing) => [ing.id, ing]));
  const merged: Ingredient[] = [];
  const included = new Set<string>();

  for (const dbIng of dbIngredients) {
    const clientIng = clientById.get(dbIng.id);
    if (!clientIng) {
      merged.push(dbIng);
      included.add(dbIng.id);
      continue;
    }

    merged.push(mergeIngredientRow(dbIng, clientIng));
    included.add(dbIng.id);
  }

  for (const clientIng of clientIngredients) {
    if (!included.has(clientIng.id)) {
      merged.push(clientIng);
    }
  }

  return merged;
}

function mergeIngredientRow(dbIng: Ingredient, clientIng: Ingredient): Ingredient {
  const dbLog = dbIng.stockLog ?? [];
  const clientLog = clientIng.stockLog ?? [];

  if (clientLog.length > dbLog.length) {
    return clientIng;
  }
  if (clientLog.length < dbLog.length) {
    return dbIng;
  }

  const dbLast = lastLogAt(dbLog);
  const clientLast = lastLogAt(clientLog);
  if (dbLast && clientLast) {
    if (dbLast > clientLast) return dbIng;
    if (clientLast > dbLast) return clientIng;
  } else if (dbLast && !clientLast) {
    return dbIng;
  } else if (clientLast && !dbLast) {
    return clientIng;
  }

  return clientIng;
}
