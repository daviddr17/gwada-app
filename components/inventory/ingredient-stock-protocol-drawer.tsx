"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { protocolDeltaWrapClass } from "@/components/inventory/protocol-menge-colors";
import type { Ingredient } from "@/lib/types/inventory";
import type { IngredientStockLogEntry } from "@/lib/types/ingredient-stock-log";
import {
  ingredientStockActionColumn,
  resolveIngredientStockLogUserLabel,
} from "@/lib/types/ingredient-stock-log";

const df = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const protocolWhenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string) {
  try {
    return df.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatProtocolWhen(iso: string) {
  try {
    return protocolWhenFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

function ingredientStockQuantityCell(e: IngredientStockLogEntry): ReactNode {
  const delta = e.toQuantity - e.fromQuantity;
  const sign = delta > 0 ? "+" : "";
  return (
    <span className="tabular-nums">
      <span className="text-foreground">{e.fromQuantity}</span>
      <span className="text-muted-foreground">→</span>
      <span className="text-foreground">{e.toQuantity}</span>{" "}
      <span className={protocolDeltaWrapClass(delta)}>({sign}{delta})</span>{" "}
      <span className="text-muted-foreground">{e.unitLabel}</span>
    </span>
  );
}

type IngredientStockProtocolDrawerProps = {
  ingredient: Ingredient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function IngredientStockProtocolDrawer({
  ingredient,
  open,
  onOpenChange,
}: IngredientStockProtocolDrawerProps) {
  const { actor } = usePersonalProfileNames();
  const entries = useMemo(
    () => (ingredient ? [...ingredient.stockLog].reverse() : []),
    [ingredient],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent
        showHandle
        className="mx-auto flex max-h-[min(88dvh,560px)] max-w-5xl flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Bestandsprotokoll
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            {ingredient ? (
              <>
                {ingredient.name} · aktueller Bestand {ingredient.currentStock} · zuletzt
                geändert {entries[0] ? formatWhen(entries[0].at) : "—"}
              </>
            ) : (
              "Keine Zutat ausgewählt."
            )}
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 sm:px-5">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Bestandsänderungen protokolliert.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full min-w-[720px] text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                    <th className="whitespace-nowrap px-2 py-2 sm:px-3">Datum</th>
                    <th className="min-w-[7rem] px-2 py-2 sm:px-3">User</th>
                    <th className="min-w-[8rem] px-2 py-2 sm:px-3">Name Zutat</th>
                    <th className="min-w-[6.5rem] px-2 py-2 sm:px-3">Mengenänderung</th>
                    <th className="min-w-[7rem] px-2 py-2 sm:px-3">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-border/35 align-top last:border-0 odd:bg-muted/15"
                    >
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground tabular-nums sm:px-3 sm:py-2">
                        {formatProtocolWhen(e.at)}
                      </td>
                      <td className="px-2 py-1.5 font-medium text-foreground sm:px-3 sm:py-2">
                        {resolveIngredientStockLogUserLabel(e, actor)}
                      </td>
                      <td className="max-w-[14rem] truncate px-2 py-1.5 text-foreground sm:max-w-none sm:px-3 sm:py-2">
                        {ingredient?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 sm:px-3 sm:py-2">
                        {ingredientStockQuantityCell(e)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
                        {ingredientStockActionColumn(e)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
