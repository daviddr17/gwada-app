"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";
import type { IngredientVoiceMatchCandidate } from "@/lib/inventory/match-ingredient-voice-query";

export type PurchaseOrderVoiceDisambiguationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heardQuery: string;
  quantity: number | null;
  candidates: IngredientVoiceMatchCandidate[];
  onSelect: (ingredientId: string) => void;
};

export function PurchaseOrderVoiceDisambiguationDialog({
  open,
  onOpenChange,
  heardQuery,
  quantity,
  candidates,
  onSelect,
}: PurchaseOrderVoiceDisambiguationDialogProps) {
  const qtyLabel =
    quantity == null
      ? "Menge offen"
      : Number.isInteger(quantity)
        ? `${quantity}×`
        : `${String(quantity).replace(".", ",")}×`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal
        className={cn(
          "pointer-events-none fixed inset-0 isolate z-[2147483000]",
        )}
      >
        <Dialog.Backdrop className="pointer-events-auto fixed inset-0 z-0 bg-black/40 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          className={cn(
            "pointer-events-auto fixed top-1/2 left-1/2 z-[1] w-[min(100%-1.5rem,22rem)] -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-border/60 bg-popover p-5 text-popover-foreground shadow-none ring-1 ring-black/5 dark:shadow-xl dark:ring-white/10",
          )}
        >
          <Dialog.Title className="text-base font-semibold text-foreground">
            Welche Zutat?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Für „{heardQuery}" ({qtyLabel}) gibt es mehrere Treffer — bitte
            antippen.
          </Dialog.Description>

          <div className="mt-4 flex flex-col gap-2">
            {candidates.map((candidate) => (
              <Button
                key={candidate.ingredient.id}
                type="button"
                className={cn(
                  "h-11 w-full justify-start rounded-xl px-4 text-sm font-medium",
                  brandActionButtonRoundedClassName,
                )}
                onClick={() => onSelect(candidate.ingredient.id)}
              >
                {candidate.ingredient.name}
              </Button>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
