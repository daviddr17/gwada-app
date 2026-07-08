"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  INVENTORY_BRANDS_KEY,
  INVENTORY_SUPPLIERS_KEY,
  INVENTORY_UNITS_KEY,
} from "@/lib/constants/inventory-storage";
import {
  SEED_BRANDS,
  SEED_SUPPLIERS,
  SEED_UNITS,
} from "@/lib/data/inventory-seeds";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { useInventoryTaxonomyStorage } from "@/lib/hooks/use-inventory-taxonomy-storage";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  applyPurchaseOrderVoiceLines,
  resolvePurchaseOrderVoiceLines,
  type PurchaseOrderVoiceResolvedLine,
} from "@/lib/inventory/purchase-order-voice-apply";
import {
  formatParsedPurchaseOrderVoicePreview,
  parsePurchaseOrderVoiceText,
} from "@/lib/inventory/parse-purchase-order-voice-text";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

export function PurchaseOrderVoiceFab() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { ingredients, isHydrated: ingredientsHydrated } = useIngredientsStorage();
  const {
    addLine,
    updateLineQuantity,
    getOpenLineContext,
    isHydrated: ordersHydrated,
  } = usePurchaseOrdersStorage();
  const suppliers = useInventoryTaxonomyStorage(
    INVENTORY_SUPPLIERS_KEY,
    SEED_SUPPLIERS,
  );
  const brands = useInventoryTaxonomyStorage(INVENTORY_BRANDS_KEY, SEED_BRANDS);
  const units = useInventoryTaxonomyStorage(INVENTORY_UNITS_KEY, SEED_UNITS);
  const { actor, isHydrated: actorHydrated } = usePersonalProfileNames();

  const [mounted, setMounted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingLines, setPendingLines] = useState<
    PurchaseOrderVoiceResolvedLine[] | null
  >(null);
  const [heardText, setHeardText] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const dataReady =
    ready &&
    Boolean(restaurantId) &&
    ingredientsHydrated &&
    ordersHydrated &&
    actorHydrated &&
    suppliers.isHydrated &&
    brands.isHydrated &&
    units.isHydrated;

  const handleFinalTranscript = useCallback(
    (transcript: string) => {
      setHeardText(transcript);
      const parseResult = parsePurchaseOrderVoiceText(transcript);
      if (!parseResult.ok) {
        toast.error(parseResult.error, {
          description: 'Beispiel: „3 Tomaten" oder „2 Zwiebeln und 1 Mehl"',
        });
        return;
      }

      const resolveResult = resolvePurchaseOrderVoiceLines({
        parsed: parseResult.parsed,
        ingredients,
        suppliers: suppliers.items,
        brands: brands.items,
        units: units.items,
        getOpenLineContext,
      });
      if (!resolveResult.ok) {
        toast.error(resolveResult.error);
        return;
      }

      setPendingLines(resolveResult.lines);
      setConfirmOpen(true);
    },
    [
      brands.items,
      getOpenLineContext,
      ingredients,
      suppliers.items,
      units.items,
    ],
  );

  const handleSpeechError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    lang: "de-DE",
    onFinal: handleFinalTranscript,
    onError: handleSpeechError,
  });

  const toggleListening = () => {
    if (listening) stop();
    else start();
  };

  const handleConfirm = async () => {
    if (!pendingLines?.length) return;
    const result = await applyPurchaseOrderVoiceLines({
      lines: pendingLines,
      actor,
      getOpenLineContext,
      addLine,
      updateLineQuantity,
    });
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success(
      pendingLines.length === 1
        ? "Bestellung angepasst."
        : `${pendingLines.length} Positionen zur Bestellung hinzugefügt.`,
    );
    setPendingLines(null);
    setHeardText("");
  };

  if (!mounted || !dataReady || !supported) return null;

  const preview = pendingLines
    ? formatParsedPurchaseOrderVoicePreview(pendingLines)
    : null;
  const liveCaption = listening ? interim || "Hört zu …" : null;

  return createPortal(
    <>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPendingLines(null);
        }}
        title="Zur Bestellung hinzufügen?"
        description={
          <div className="space-y-2 text-sm text-muted-foreground">
            {preview ? (
              <p className="font-medium text-foreground">{preview}</p>
            ) : null}
            {heardText ? (
              <p className="text-xs italic">„{heardText}"</p>
            ) : null}
            <p>
              Bestätigen legt die Mengen in die offene Bestellung — bei
              vorhandenen Positionen wird die Menge ersetzt, nicht addiert.
            </p>
          </div>
        }
        confirmLabel="Hinzufügen"
        cancelLabel="Abbrechen"
        destructive={false}
        onConfirm={handleConfirm}
      />

      <div
        className="pointer-events-none fixed end-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[120] flex flex-col items-end gap-2 sm:end-6"
        data-purchase-order-voice-fab
      >
        {liveCaption ? (
          <div
            className={cn(
              "pointer-events-none max-w-[min(18rem,calc(100vw-5rem))] rounded-2xl border border-border/50 bg-card/95 px-3 py-2 text-sm text-foreground shadow-card backdrop-blur-md",
              listening && "animate-pulse",
            )}
          >
            {liveCaption}
          </div>
        ) : null}

        <button
          type="button"
          aria-label={
            listening
              ? "Aufnahme beenden"
              : "Bestellung per Sprache hinzufügen"
          }
          aria-pressed={listening}
          className={cn(
            "pointer-events-auto flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
            brandActionButtonClassName,
            listening && "ring-4 ring-accent/30",
          )}
          onClick={toggleListening}
        >
          {listening ? (
            <Square className="size-5 fill-current" aria-hidden />
          ) : (
            <Mic className="size-6" strokeWidth={2.25} aria-hidden />
          )}
        </button>
      </div>
    </>,
    document.body,
  );
}
