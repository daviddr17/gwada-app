"use client";

import { Plus, Trash2 } from "lucide-react";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { cn } from "@/lib/utils";
import { moduleDataTableHeadRowMutedClassName } from "@/lib/ui/module-data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  SearchableSelect,
  TagMultiCombobox,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField } from "@/components/ui/date-picker";
import type {
  MenuCategoryDefinition,
  MenuItem,
  MenuOptionGroup,
  MenuRecipeLine,
  MenuTag,
  MenuTaxonomyDefinition,
  NewMenuItem,
} from "@/lib/types/menu";
import type { Ingredient, InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import {
  computeFoodCostPercent,
  computeRecipeCost,
  formatEuroAmount,
} from "@/lib/menu/recipe-cost-utils";

type FormState = {
  name: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  tags: MenuTag[];
  optionGroupIds: string[];
  active: boolean;
  listNumber: string;
  availableFrom: string;
  availableTo: string;
  recipe: { ingredientId: string; amount: string }[];
};

const emptyForm: FormState = {
  name: "",
  description: "",
  price: "",
  category: "",
  imageUrl: "",
  tags: [],
  optionGroupIds: [],
  active: true,
  listNumber: "",
  availableFrom: "",
  availableTo: "",
  recipe: [],
};

const dishFieldLabelClassName = "text-xs text-muted-foreground";

function DishFormSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DrawerFormSection title={title} className={className}>
      {children}
    </DrawerFormSection>
  );
}

function itemToFormState(item: MenuItem): FormState {
  return {
    name: item.name,
    description: item.description,
    price: String(item.price),
    category: item.category,
    imageUrl: item.imageUrl,
    tags: item.tags,
    optionGroupIds: item.optionGroupIds ?? [],
    active: item.active !== false,
    listNumber:
      item.listNumber != null && !Number.isNaN(item.listNumber)
        ? String(item.listNumber)
        : "",
    availableFrom: item.availableFrom ?? "",
    availableTo: item.availableTo ?? "",
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
  /** Tags + Allergene (Stammdaten) für Auswahl und Chips */
  tagDefinitions: MenuTaxonomyDefinition[];
  /** Optionsgruppen (Beilagen, Extras, …) */
  optionGroups: MenuOptionGroup[];
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
  tagDefinitions,
  optionGroups,
  stockUnits,
  onSubmit,
  onCancel,
}: DishFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recipeLineRemoveIndex, setRecipeLineRemoveIndex] = useState<
    number | null
  >(null);

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

  const optionGroupDefinitions = useMemo(
    (): MenuTaxonomyDefinition[] =>
      optionGroups
        .filter((g) => g.active !== false)
        .map((g) => ({
          id: g.id,
          name: g.name,
          backgroundColor: "#0f766e",
          active: true,
        })),
    [optionGroups],
  );

  const unitNameById = useMemo(
    () => new Map(stockUnits.map((u) => [u.id, u.name])),
    [stockUnits],
  );

  const ingredientsById = useMemo(
    () => new Map(ingredients.map((x) => [x.id, x])),
    [ingredients],
  );

  const recipeCostSummary = useMemo(() => {
    const cost = computeRecipeCost(form.recipe, ingredientsById);
    const sellRaw = form.price.trim().replace(",", ".");
    const sellPrice =
      sellRaw === "" ? null : Number.parseFloat(sellRaw);
    const foodCostPercent = computeFoodCostPercent(
      cost.allPriced ? cost.totalCost : null,
      sellPrice != null && !Number.isNaN(sellPrice) ? sellPrice : null,
    );
    return { cost, foodCostPercent };
  }, [form.price, form.recipe, ingredientsById]);

  const recipeRemoveLabel = useMemo(() => {
    if (recipeLineRemoveIndex === null) return "";
    const line = form.recipe[recipeLineRemoveIndex];
    if (!line) return "";
    const ing = ingredients.find((x) => x.id === line.ingredientId);
    return ing?.name?.trim() || "Rezeptzeile";
  }, [recipeLineRemoveIndex, form.recipe, ingredients]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (mode === "edit" && initialItem) {
        setForm(itemToFormState(initialItem));
      } else {
        setForm(emptyForm);
      }
      setErrors({});
      setRecipeLineRemoveIndex(null);
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
    const from = form.availableFrom.trim();
    const to = form.availableTo.trim();
    if (from && to && to < from) {
      next.availableTo = "Enddatum darf nicht vor Startdatum liegen";
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
      optionGroupIds: form.optionGroupIds,
      active: form.active,
      listNumber,
      availableFrom: form.availableFrom.trim() || null,
      availableTo: form.availableTo.trim() || null,
      recipe: recipe.length > 0 ? recipe : null,
    });
    if (mode === "create") reset();
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className={drawerScrollAreaClassName(6)}>
        <DishFormSection>
          <div className="space-y-2">
            <Label htmlFor="dish-name" className={dishFieldLabelClassName}>
              Name
            </Label>
            <Input
              id="dish-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="z. B. Colombo de poulet"
              className="h-12 rounded-xl"
              aria-invalid={!!errors.name}
              autoFocus
            />
            {errors.name ? (
              <p className="text-sm text-destructive">{errors.name}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className={dishFieldLabelClassName}>Kategorie</Label>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Lege zuerst eine Kategorie an (Registerkarten oben).
              </p>
            ) : (
              <SearchableSelect
                options={categorySelectOptions}
                value={form.category || null}
                onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
                placeholder="Kategorie wählen"
                searchPlaceholder="Kategorie suchen…"
                aria-invalid={!!errors.category}
              />
            )}
            {errors.category ? (
              <p className="text-sm text-destructive">{errors.category}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dish-list-number" className={dishFieldLabelClassName}>
                Anzeige-Nummer
              </Label>
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
                placeholder="Optional"
                className="h-12 rounded-xl tabular-nums"
                aria-invalid={!!errors.listNumber}
              />
              {errors.listNumber ? (
                <p className="text-sm text-destructive">{errors.listNumber}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dish-price" className={dishFieldLabelClassName}>
                Preis (€)
              </Label>
              <Input
                id="dish-price"
                type="number"
                min="0"
                step="0.1"
                value={form.price}
                onChange={(e) =>
                  setForm((p) => ({ ...p, price: e.target.value }))
                }
                placeholder="12.90"
                className="h-12 rounded-xl tabular-nums"
                aria-invalid={!!errors.price}
              />
              {errors.price ? (
                <p className="text-sm text-destructive">{errors.price}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dish-desc" className={dishFieldLabelClassName}>
              Beschreibung
            </Label>
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
        </DishFormSection>

        <DishFormSection title="Anzeige">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
            <Label htmlFor="dish-active" className="text-sm font-medium">
              Gericht aktiv
            </Label>
            <Switch
              id="dish-active"
              checked={form.active}
              onCheckedChange={(v) =>
                setForm((p) => ({ ...p, active: v === true }))
              }
              className="shrink-0"
            />
          </div>

          <div className="space-y-2">
            <Label className={dishFieldLabelClassName}>Anzeige von / bis</Label>
            <p className="text-xs text-muted-foreground">
              Optional — z. B. für Tages- oder Wochengerichte. Leer = dauerhaft
              sichtbar (wenn aktiv).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dish-available-from" className="text-xs">
                  Von
                </Label>
                <DatePickerField
                  id="dish-available-from"
                  fullWidth
                  value={form.availableFrom || null}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      availableFrom: v ?? "",
                      availableTo:
                        v && p.availableTo && p.availableTo < v ? "" : p.availableTo,
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dish-available-to" className="text-xs">
                  Bis
                </Label>
                <DatePickerField
                  id="dish-available-to"
                  fullWidth
                  value={form.availableTo || null}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, availableTo: v ?? "" }))
                  }
                  placeholder="Optional"
                  minYmd={form.availableFrom.trim() || undefined}
                  aria-invalid={!!errors.availableTo}
                />
                {errors.availableTo ? (
                  <p className="text-sm text-destructive">{errors.availableTo}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dish-image" className={dishFieldLabelClassName}>
              Bild-URL
            </Label>
            <Input
              id="dish-image"
              type="url"
              value={form.imageUrl}
              onChange={(e) =>
                setForm((p) => ({ ...p, imageUrl: e.target.value }))
              }
              placeholder="https://…"
              className="h-12 rounded-xl"
            />
          </div>
        </DishFormSection>

        <DishFormSection title="Tags & Allergene">
          <TagMultiCombobox
            id="dish-tags-combo"
            definitions={tagDefinitions}
            value={form.tags}
            onChange={(tags) => setForm((p) => ({ ...p, tags }))}
            aria-label="Tags und Allergene"
          />
        </DishFormSection>

        <DishFormSection title="Optionen">
          <p className="text-xs text-muted-foreground">
            Optional — z. B. Beilagen oder Extras. Zuerst unter „Optionen“ in der
            Übersicht anlegen, dann hier zuordnen.
          </p>
          {optionGroupDefinitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Optionsgruppen. Lege sie über den Chip{" "}
              <span className="font-medium text-foreground">Optionen</span> an.
            </p>
          ) : (
            <TagMultiCombobox
              id="dish-options-combo"
              definitions={optionGroupDefinitions}
              value={form.optionGroupIds}
              onChange={(optionGroupIds) =>
                setForm((p) => ({ ...p, optionGroupIds }))
              }
              aria-label="Optionsgruppen"
            />
          )}
        </DishFormSection>

        <DishFormSection title="Rezept">
          <p className="text-xs text-muted-foreground">
            Optional — Zutaten aus dem Bestand für die Suche nach Gerichten.
          </p>
          {ingredients.filter((x) => x.active !== false).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Lege zuerst Zutaten unter{" "}
              <span className="font-medium text-foreground">Bestand</span> an.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-lg border border-border/50 bg-muted/10">
                <table className="w-full min-w-[320px] table-fixed text-sm">
                  <thead>
                    <tr className={moduleDataTableHeadRowMutedClassName}>
                      <th className="w-[40%] px-2 py-1.5 font-medium">Zutat</th>
                      <th className="w-[16%] px-1 py-1.5 font-medium">Einheit</th>
                      <th className="w-[16%] px-1 py-1.5 font-medium">Menge</th>
                      <th className="w-[18%] px-1 py-1.5 font-medium text-right">
                        EK
                      </th>
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
                      const amountParsed = Number.parseFloat(
                        line.amount.replace(",", "."),
                      );
                      const lineCost =
                        ing?.purchaseUnitPrice != null &&
                        Number.isFinite(ing.purchaseUnitPrice) &&
                        !Number.isNaN(amountParsed) &&
                        amountParsed > 0
                          ? amountParsed * ing.purchaseUnitPrice
                          : null;
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
                            <td className="p-1 align-middle text-right">
                              <div className="flex min-h-9 items-center justify-end rounded-lg border border-border/50 bg-background/90 px-2 text-xs tabular-nums text-muted-foreground">
                                {lineCost != null
                                  ? formatEuroAmount(lineCost)
                                  : "—"}
                              </div>
                            </td>
                            <td className="p-0.5 align-middle text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label="Zeile entfernen"
                                onClick={() => setRecipeLineRemoveIndex(i)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                          {err ? (
                            <tr className="border-b border-border/35 last:border-b-0">
                              <td
                                colSpan={5}
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
              {form.recipe.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm">
                  <span>
                    <span className="text-muted-foreground">Gesamt-EK: </span>
                    <span className="font-medium tabular-nums">
                      {recipeCostSummary.cost.allPriced &&
                      recipeCostSummary.cost.totalCost != null
                        ? formatEuroAmount(recipeCostSummary.cost.totalCost)
                        : recipeCostSummary.cost.totalCost != null
                          ? `${formatEuroAmount(recipeCostSummary.cost.totalCost)}*`
                          : "—"}
                    </span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Food-Cost: </span>
                    <span className="font-medium tabular-nums">
                      {recipeCostSummary.foodCostPercent != null
                        ? `${recipeCostSummary.foodCostPercent.toFixed(1).replace(".", ",")} %`
                        : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      (vs. VK)
                    </span>
                  </span>
                  {!recipeCostSummary.cost.allPriced &&
                  recipeCostSummary.cost.lines.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      * Nicht alle Zutaten haben einen Einkaufspreis
                    </span>
                  ) : null}
                </div>
              ) : null}
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
        </DishFormSection>
      </div>

      <DrawerFormFooter
        onCancel={() => onCancel?.()}
        showCancel={!!onCancel}
        submitType="submit"
        submitLabel={mode === "edit" ? "Speichern" : "Hinzufügen"}
      />
    </form>

    <ConfirmDialog
      open={recipeLineRemoveIndex !== null}
      onOpenChange={(o) => {
        if (!o) setRecipeLineRemoveIndex(null);
      }}
      title="Rezeptzeile entfernen?"
      description={
        recipeRemoveLabel ? (
          <>
            „<span className="font-medium text-foreground">{recipeRemoveLabel}</span>“
            wird aus dem Rezept entfernt. Zum Speichern danach „Speichern“ wählen.
          </>
        ) : null
      }
      confirmLabel="Entfernen"
      destructive={false}
      onConfirm={async () => {
        const i = recipeLineRemoveIndex;
        if (i === null) return;
        setForm((p) => ({ ...p, recipe: p.recipe.filter((_, j) => j !== i) }));
      }}
    />
    </>
  );
}
