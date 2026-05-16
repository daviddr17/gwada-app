"use client";

import { Plus, Trash2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SearchableSelect,
  TagMultiCombobox,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  MenuCategoryDefinition,
  MenuItem,
  MenuRecipeLine,
  MenuTag,
  NewMenuItem,
} from "@/lib/types/menu";
import type { Ingredient, InventoryTaxonomyDefinition } from "@/lib/types/inventory";

type FormState = {
  name: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  tags: MenuTag[];
  active: boolean;
  listNumber: string;
  recipe: { ingredientId: string; amount: string }[];
};

const emptyForm: FormState = {
  name: "",
  description: "",
  price: "",
  category: "",
  imageUrl: "",
  tags: [],
  active: true,
  listNumber: "",
  recipe: [],
};

function itemToFormState(item: MenuItem): FormState {
  return {
    name: item.name,
    description: item.description,
    price: String(item.price),
    category: item.category,
    imageUrl: item.imageUrl,
    tags: item.tags,
    active: item.active !== false,
    listNumber:
      item.listNumber != null && !Number.isNaN(item.listNumber)
        ? String(item.listNumber)
        : "",
    recipe: (item.recipe ?? []).map((l) => ({
      ingredientId: l.ingredientId,
      amount: String(l.amount),
    })),
  };
}

type DishFormProps = {
  mode: "create" | "edit";
  initialItem?: MenuItem;
  categories: MenuCategoryDefinition[];
  ingredients: Ingredient[];
  /** Lagereinheiten (Bestand) – für Anzeige im Rezept */
  stockUnits: InventoryTaxonomyDefinition[];
  onSubmit: (item: NewMenuItem) => void;
  onCancel?: () => void;
};

export function DishForm({
  mode,
  initialItem,
  categories,
  ingredients,
  stockUnits,
  onSubmit,
  onCancel,
}: DishFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categorySelectOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: `${c.name}${c.active === false ? " · inaktiv" : ""}`,
      })),
    [categories],
  );

  const ingredientSelectOptions = useMemo(
    () =>
      ingredients
        .filter((x) => x.active !== false)
        .map((x) => ({ value: x.id, label: x.name })),
    [ingredients],
  );

  const unitNameById = useMemo(
    () => new Map(stockUnits.map((u) => [u.id, u.name])),
    [stockUnits],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (mode === "edit" && initialItem) {
        setForm(itemToFormState(initialItem));
      } else {
        setForm(emptyForm);
      }
      setErrors({});
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, initialItem]);

  const reset = useCallback(() => {
    setForm(
      mode === "edit" && initialItem ? itemToFormState(initialItem) : emptyForm,
    );
    setErrors({});
  }, [mode, initialItem]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name ist erforderlich";
    const price = parseFloat(form.price);
    if (!form.price || Number.isNaN(price) || price <= 0)
      next.price = "Gültiger Preis erforderlich";
    if (!form.category) next.category = "Kategorie wählen";
    const ln = form.listNumber.trim();
    if (ln !== "") {
      const n = parseInt(ln, 10);
      if (Number.isNaN(n) || n < 0) {
        next.listNumber = "Ganze Zahl ≥ 0";
      }
    }
    form.recipe.forEach((line, i) => {
      if (!line.ingredientId.trim()) return;
      const a = Number.parseFloat(line.amount.replace(",", "."));
      if (Number.isNaN(a) || a <= 0) {
        next[`recipe_${i}`] = "Menge größer 0 erforderlich";
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const ln = form.listNumber.trim();
    let listNumber: number | null = null;
    if (ln !== "") {
      listNumber = parseInt(ln, 10);
    }
    const recipe: MenuRecipeLine[] = [];
    for (const line of form.recipe) {
      if (!line.ingredientId.trim()) continue;
      const a = Number.parseFloat(line.amount.replace(",", "."));
      if (Number.isNaN(a) || a <= 0) continue;
      recipe.push({ ingredientId: line.ingredientId, amount: a });
    }
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      category: form.category,
      imageUrl:
        form.imageUrl.trim() ||
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
      tags: form.tags,
      active: form.active,
      listNumber,
      recipe: recipe.length > 0 ? recipe : null,
    });
    if (mode === "create") reset();
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 pb-4">
        <div className="space-y-2">
          <Label htmlFor="dish-name">Name</Label>
          <Input
            id="dish-name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="z. B. Colombo de poulet"
            className="h-12 rounded-xl"
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/25 px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="dish-active" className="text-sm font-medium">
              Aktiv
            </Label>
            <p className="text-xs text-muted-foreground">
              Inaktive Gerichte bleiben in der Übersicht sichtbar und werden
              gekennzeichnet.
            </p>
          </div>
          <Switch
            id="dish-active"
            checked={form.active}
            onCheckedChange={(v) =>
              setForm((p) => ({ ...p, active: v === true }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dish-desc">Beschreibung</Label>
          <Textarea
            id="dish-desc"
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="Kurze Beschreibung"
            rows={3}
            className="resize-none rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dish-price">Preis (€)</Label>
          <Input
            id="dish-price"
            type="number"
            min="0"
            step="0.1"
            value={form.price}
            onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
            placeholder="12.90"
            className="h-12 rounded-xl tabular-nums"
            aria-invalid={!!errors.price}
          />
          {errors.price && (
            <p className="text-sm text-destructive">{errors.price}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dish-list-number">Anzeige-Nummer (optional)</Label>
          <Input
            id="dish-list-number"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={form.listNumber}
            onChange={(e) =>
              setForm((p) => ({ ...p, listNumber: e.target.value }))
            }
            placeholder="z. B. 10"
            className="h-12 rounded-xl tabular-nums"
            aria-invalid={!!errors.listNumber}
          />
          {errors.listNumber && (
            <p className="text-sm text-destructive">{errors.listNumber}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Niedrigere Nummern erscheinen zuerst innerhalb der Kategorie.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Kategorie</Label>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Lege zuerst eine Kategorie an (Registerkarten oben).
            </p>
          ) : (
            <SearchableSelect
              options={categorySelectOptions}
              value={form.category || null}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, category: v }))
              }
              placeholder="Kategorie wählen"
              searchPlaceholder="Kategorie suchen…"
              aria-invalid={!!errors.category}
            />
          )}
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dish-image">Bild-URL</Label>
          <Input
            id="dish-image"
            type="url"
            value={form.imageUrl}
            onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
            placeholder="https://…"
            className="h-12 rounded-xl"
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="dish-tags-combo">Tags &amp; Allergene</Label>
          <TagMultiCombobox
            id="dish-tags-combo"
            value={form.tags}
            onChange={(tags) => setForm((p) => ({ ...p, tags }))}
            aria-label="Tags und Allergene"
          />
          <p className="text-xs text-muted-foreground">
            Mehrfachauswahl mit Suche – wie in der Karte filterbar.
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <Label>Rezept (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Zutaten aus dem Bestand mit Menge in der jeweiligen Lagereinheit der
              Zutat. Wird für die Suche nach Zutaten genutzt.
            </p>
          </div>
          {ingredients.filter((x) => x.active !== false).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Lege zuerst Zutaten unter{" "}
              <span className="font-medium text-foreground">Bestand</span> an.
            </p>
          ) : (
            <div className="space-y-2">
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
                    {form.recipe.map((line, i) => {
                      const ing = ingredients.find(
                        (x) => x.id === line.ingredientId,
                      );
                      const unitLabel = ing
                        ? (unitNameById.get(ing.unit) ?? ing.unit)
                        : "—";
                      const err = errors[`recipe_${i}`];
                      return (
                        <Fragment key={i}>
                          <tr className="border-b border-border/35 last:border-b-0">
                            <td className="p-1 align-middle">
                              <SearchableSelect
                                options={ingredientSelectOptions}
                                value={line.ingredientId || null}
                                onValueChange={(v) =>
                                  setForm((p) => {
                                    const recipe = [...p.recipe];
                                    recipe[i] = {
                                      ...recipe[i]!,
                                      ingredientId: v,
                                    };
                                    return { ...p, recipe };
                                  })
                                }
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
                                inputMode="decimal"
                                value={line.amount}
                                onChange={(e) =>
                                  setForm((p) => {
                                    const recipe = [...p.recipe];
                                    recipe[i] = {
                                      ...recipe[i]!,
                                      amount: e.target.value,
                                    };
                                    return { ...p, recipe };
                                  })
                                }
                                className="h-9 rounded-lg px-2 text-sm tabular-nums"
                                aria-invalid={!!err}
                              />
                            </td>
                            <td className="p-0.5 align-middle text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label="Zeile entfernen"
                                onClick={() =>
                                  setForm((p) => ({
                                    ...p,
                                    recipe: p.recipe.filter((_, j) => j !== i),
                                  }))
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                          {err ? (
                            <tr className="border-b border-border/35 last:border-b-0">
                              <td
                                colSpan={4}
                                className="px-2 pb-1.5 text-xs text-destructive"
                              >
                                {err}
                              </td>
                            </tr>
                          ) : null}
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
                onClick={() => {
                  const pick =
                    ingredients.find((x) => x.active !== false)?.id ?? "";
                  setForm((p) => ({
                    ...p,
                    recipe: [...p.recipe, { ingredientId: pick, amount: "100" }],
                  }));
                }}
              >
                <Plus className="size-3.5" />
                Zutat hinzufügen
              </Button>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex gap-3 px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl tap-scale"
            onClick={onCancel}
          >
            Abbrechen
          </Button>
        )}
        <Button
          type="submit"
          className="h-12 flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 tap-scale"
        >
          {mode === "edit" ? "Speichern" : "Hinzufügen"}
        </Button>
      </div>
    </form>
  );
}
