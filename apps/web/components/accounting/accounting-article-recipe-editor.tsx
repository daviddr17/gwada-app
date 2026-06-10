"use client";

import { Fragment, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchableSelect } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import type { AccountingArticleRecipeLine } from "@/lib/types/accounting";
import type { Ingredient, InventoryTaxonomyDefinition } from "@/lib/types/inventory";

export type AccountingArticleRecipeDraftLine = {
  ingredientId: string;
  amount: string;
};

type AccountingArticleRecipeEditorProps = {
  lines: AccountingArticleRecipeDraftLine[];
  onChange: (lines: AccountingArticleRecipeDraftLine[]) => void;
  ingredients: Ingredient[];
  stockUnits: InventoryTaxonomyDefinition[];
  disabled?: boolean;
};

export function recipeDraftFromLines(
  recipe: AccountingArticleRecipeLine[] | undefined,
): AccountingArticleRecipeDraftLine[] {
  if (!recipe?.length) return [];
  return recipe.map((l) => ({
    ingredientId: l.ingredientId,
    amount: String(l.amount),
  }));
}

export function normalizeRecipeDraft(
  lines: AccountingArticleRecipeDraftLine[],
): AccountingArticleRecipeLine[] | null {
  const out: AccountingArticleRecipeLine[] = [];
  for (const line of lines) {
    const ingredientId = line.ingredientId.trim();
    if (!ingredientId) continue;
    const amount = Number.parseFloat(line.amount.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) continue;
    out.push({ ingredientId, amount });
  }
  if (!out.length) return null;
  const merged = new Map<string, number>();
  for (const l of out) {
    merged.set(l.ingredientId, (merged.get(l.ingredientId) ?? 0) + l.amount);
  }
  return [...merged.entries()].map(([ingredientId, amount]) => ({
    ingredientId,
    amount,
  }));
}

export function AccountingArticleRecipeEditor({
  lines,
  onChange,
  ingredients,
  stockUnits,
  disabled,
}: AccountingArticleRecipeEditorProps) {
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  const activeIngredients = useMemo(
    () => ingredients.filter((x) => x.active !== false),
    [ingredients],
  );

  const unitNameById = useMemo(
    () => new Map(stockUnits.map((u) => [u.id, u.name])),
    [stockUnits],
  );

  const ingredientOptions = useMemo(
    () =>
      activeIngredients.map((i) => ({
        value: i.id,
        label: i.name,
      })),
    [activeIngredients],
  );

  const removeLabel =
    removeIndex != null
      ? activeIngredients.find((i) => i.id === lines[removeIndex]?.ingredientId)
          ?.name
      : null;

  if (activeIngredients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Lege zuerst Zutaten unter{" "}
        <span className="font-medium text-foreground">Bestand</span> an.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Optional — Zutaten pro verkaufter Einheit. Bei aktivierter Einstellung
          wird der Bestand bei Rechnungserstellung abgezogen.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border/50 bg-muted/10">
          <table className="w-full min-w-[260px] table-fixed text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/40 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <th className="w-[55%] px-2 py-1.5 font-medium">Zutat</th>
                <th className="w-[22%] px-1 py-1.5 font-medium">Einheit</th>
                <th className="w-[18%] px-1 py-1.5 font-medium">Menge</th>
                <th
                  className="w-10 px-1 py-1.5 text-center font-medium"
                  aria-label="Aktion"
                >
                  <span className="sr-only">Entfernen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const ing = activeIngredients.find(
                  (x) => x.id === line.ingredientId,
                );
                const unitLabel = ing
                  ? (unitNameById.get(ing.unit) ?? ing.unit)
                  : "—";
                return (
                  <Fragment key={i}>
                    <tr className="border-b border-border/35 last:border-b-0">
                      <td className="p-1 align-middle">
                        <SearchableSelect
                          disabled={disabled}
                          options={ingredientOptions}
                          value={line.ingredientId || null}
                          onValueChange={(v) => {
                            const next = [...lines];
                            next[i] = { ...next[i]!, ingredientId: v };
                            onChange(next);
                          }}
                          placeholder="Zutat"
                          searchPlaceholder="Suchen…"
                          className="min-h-9 rounded-lg border-border/60 text-sm shadow-none"
                        />
                      </td>
                      <td className="p-1 align-middle">
                        <div
                          className="flex min-h-9 items-center rounded-lg border border-border/50 bg-background/90 px-2 text-xs leading-tight text-foreground"
                          title={unitLabel}
                        >
                          <span className="line-clamp-2 break-words">
                            {unitLabel}
                          </span>
                        </div>
                      </td>
                      <td className="p-1 align-middle">
                        <Input
                          disabled={disabled}
                          inputMode="decimal"
                          value={line.amount}
                          onChange={(e) => {
                            const next = [...lines];
                            next[i] = { ...next[i]!, amount: e.target.value };
                            onChange(next);
                          }}
                          className="h-9 rounded-lg px-2 text-sm tabular-nums"
                        />
                      </td>
                      <td className="p-0.5 align-middle text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="Zeile entfernen"
                          disabled={disabled}
                          onClick={() => setRemoveIndex(i)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full gap-1.5 rounded-lg sm:w-auto"
          disabled={disabled}
          onClick={() => {
            const pick = activeIngredients[0]?.id ?? "";
            onChange([...lines, { ingredientId: pick, amount: "1" }]);
          }}
        >
          <Plus className="size-3.5" />
          Zutat hinzufügen
        </Button>
      </div>

      <ConfirmDialog
        open={removeIndex !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveIndex(null);
        }}
        title="Rezeptzeile entfernen?"
        description={
          removeLabel ? (
            <>
              „<span className="font-medium text-foreground">{removeLabel}</span>“
              wird aus dem Rezept entfernt.
            </>
          ) : null
        }
        confirmLabel="Entfernen"
        destructive={false}
        onConfirm={async () => {
          if (removeIndex == null) return;
          onChange(lines.filter((_, idx) => idx !== removeIndex));
          setRemoveIndex(null);
        }}
      />
    </>
  );
}
