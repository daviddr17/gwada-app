"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MenuItem, MenuOptionGroup } from "@/lib/types/menu";
import type { PublicOrderingRecipeIngredient } from "@/lib/ordering/online-ordering-types";
import {
  formatEuroFromCents,
  type GuestCartLine,
  type GuestCartModifier,
} from "@/lib/ordering/guest-cart-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MenuItem | null;
  optionGroups: MenuOptionGroup[];
  recipe: PublicOrderingRecipeIngredient[];
  accentHex: string;
  largeTouch?: boolean;
  onConfirm: (line: Omit<GuestCartLine, "key">) => void;
};

export function GuestOrderConfigureSheet({
  open,
  onOpenChange,
  item,
  optionGroups,
  recipe,
  accentHex,
  largeTouch = false,
  onConfirm,
}: Props) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedChoices, setSelectedChoices] = useState<
    Record<string, string[]>
  >({});
  const [ohneIds, setOhneIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const groupsForItem = useMemo(() => {
    if (!item) return [];
    const ids = new Set(item.optionGroupIds ?? []);
    return optionGroups.filter((g) => ids.has(g.id) && g.active);
  }, [item, optionGroups]);

  const baseCents = item ? Math.round(Number(item.price) * 100) : 0;

  const modifiers: GuestCartModifier[] = useMemo(() => {
    const list: GuestCartModifier[] = [];
    for (const group of groupsForItem) {
      const chosen = selectedChoices[group.id] ?? [];
      for (const choiceId of chosen) {
        const choice = group.choices.find((c) => c.id === choiceId);
        if (!choice) continue;
        list.push({
          type: "option",
          label: `${group.name}: ${choice.name}`,
          optionChoiceId: choice.id,
          priceDeltaCents: Math.round(Number(choice.priceDelta) * 100),
        });
      }
    }
    for (const id of ohneIds) {
      const ing = recipe.find((r) => r.ingredientId === id);
      if (!ing) continue;
      list.push({
        type: "ohne",
        label: `ohne ${ing.name}`,
        ingredientId: id,
        priceDeltaCents: 0,
      });
    }
    if (notes.trim()) {
      list.push({ type: "text", label: notes.trim(), priceDeltaCents: 0 });
    }
    return list;
  }, [groupsForItem, selectedChoices, ohneIds, recipe, notes]);

  const unitCents =
    baseCents +
    modifiers.reduce((s, m) => s + (m.priceDeltaCents ?? 0), 0);

  function resetLocal() {
    setQty(1);
    setNotes("");
    setSelectedChoices({});
    setOhneIds([]);
    setError(null);
  }

  function toggleChoice(group: MenuOptionGroup, choiceId: string) {
    setSelectedChoices((prev) => {
      const cur = prev[group.id] ?? [];
      const max = group.maxSelect ?? 99;
      if (cur.includes(choiceId)) {
        return { ...prev, [group.id]: cur.filter((id) => id !== choiceId) };
      }
      if (max <= 1) {
        return { ...prev, [group.id]: [choiceId] };
      }
      if (cur.length >= max) return prev;
      return { ...prev, [group.id]: [...cur, choiceId] };
    });
  }

  function handleConfirm() {
    if (!item) return;
    for (const group of groupsForItem) {
      const count = (selectedChoices[group.id] ?? []).length;
      if (count < group.minSelect) {
        setError(`Bitte bei „${group.name}“ mindestens ${group.minSelect} wählen.`);
        return;
      }
    }
    onConfirm({
      menuItemId: item.id,
      name: item.name,
      unitPriceCents: unitCents,
      quantity: qty,
      notes: notes.trim() || undefined,
      ohneIngredientIds: ohneIds,
      modifiers,
    });
    resetLocal();
    onOpenChange(false);
  }

  const btn = largeTouch ? "h-14 min-w-14 text-lg" : "h-11";

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) resetLocal();
        onOpenChange(next);
      }}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-2xl">
        <DrawerHeader>
          <DrawerTitle className={cn(largeTouch && "text-2xl")}>
            {item?.name ?? "Gericht"}
          </DrawerTitle>
          {item?.description ? (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          ) : null}
        </DrawerHeader>

        <div className="space-y-5 overflow-y-auto px-4 pb-2">
          {groupsForItem.map((group) => (
            <div key={group.id} className="space-y-2">
              <p className={cn("font-medium", largeTouch && "text-lg")}>
                {group.name}
                {group.minSelect > 0 ? (
                  <span className="ml-1 text-muted-foreground">
                    (mind. {group.minSelect}
                    {group.maxSelect ? `, max. ${group.maxSelect}` : ""})
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.choices
                  .filter((c) => c.active)
                  .map((choice) => {
                    const active = (selectedChoices[group.id] ?? []).includes(
                      choice.id,
                    );
                    const delta = Math.round(Number(choice.priceDelta) * 100);
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => toggleChoice(group, choice.id)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left transition-colors",
                          largeTouch && "min-h-14 px-4 text-base",
                          active
                            ? "border-transparent text-white"
                            : "border-border/60 bg-background",
                        )}
                        style={
                          active
                            ? { backgroundColor: accentHex }
                            : undefined
                        }
                      >
                        {choice.name}
                        {delta !== 0
                          ? ` (${delta > 0 ? "+" : ""}${formatEuroFromCents(delta)})`
                          : ""}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}

          {recipe.length > 0 ? (
            <div className="space-y-2">
              <p className={cn("font-medium", largeTouch && "text-lg")}>
                Ohne …
              </p>
              <div className="flex flex-wrap gap-2">
                {recipe.map((ing) => {
                  const active = ohneIds.includes(ing.ingredientId);
                  return (
                    <button
                      key={ing.ingredientId}
                      type="button"
                      onClick={() =>
                        setOhneIds((prev) =>
                          active
                            ? prev.filter((id) => id !== ing.ingredientId)
                            : [...prev, ing.ingredientId],
                        )
                      }
                      className={cn(
                        "rounded-xl border px-3 py-2 transition-colors",
                        largeTouch && "min-h-14 px-4 text-base",
                        active
                          ? "border-transparent text-white"
                          : "border-border/60",
                      )}
                      style={
                        active ? { backgroundColor: accentHex } : undefined
                      }
                    >
                      ohne {ing.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="guest-order-notes">Hinweis</Label>
            <Input
              id="guest-order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. extra scharf"
              className={cn(largeTouch && "h-14 text-lg")}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("rounded-full", btn)}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="size-5" />
              </Button>
              <span className={cn("w-8 text-center font-semibold", largeTouch && "text-xl")}>
                {qty}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("rounded-full", btn)}
                onClick={() => setQty((q) => Math.min(99, q + 1))}
              >
                <Plus className="size-5" />
              </Button>
            </div>
            <p className={cn("font-semibold", largeTouch && "text-xl")}>
              {formatEuroFromCents(unitCents * qty)}
            </p>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DrawerFooter>
          <Button
            type="button"
            size="lg"
            className={cn(
              "w-full rounded-xl text-white",
              largeTouch && "h-16 text-lg",
            )}
            style={{ backgroundColor: accentHex }}
            onClick={handleConfirm}
          >
            In den Warenkorb
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
