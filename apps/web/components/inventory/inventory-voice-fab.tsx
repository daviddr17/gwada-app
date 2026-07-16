"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { InventoryVoiceConfirmSheet } from "@/components/inventory/inventory-voice-confirm-sheet";
import { PurchaseOrderVoiceDisambiguationDialog } from "@/components/inventory/purchase-order-voice-disambiguation-dialog";
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
  applyInventoryStockVoiceLines,
  applyPurchaseOrderVoiceLines,
  buildPurchaseOrderVoiceItems,
  resolveInventoryVoiceLineForIngredient,
  resolveInventoryVoiceLines,
  type InventoryVoiceMode,
  type PurchaseOrderVoiceAmbiguity,
  type PurchaseOrderVoiceItemInput,
  type PurchaseOrderVoiceResolvedLine,
} from "@/lib/inventory/purchase-order-voice-apply";
import { parsePurchaseOrderVoiceText } from "@/lib/inventory/parse-purchase-order-voice-text";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import {
  appMobileFabBottomClassName,
  appMobileFabButtonClassName,
  appMobileFabIconClassName,
  appMobileFabStopIconClassName,
} from "@/lib/ui/app-mobile-bottom-nav";
import { SpeechLiveCaption } from "@/lib/ui/speech-live-caption";
import { cn } from "@/lib/utils";

const COPY = {
  stock: {
    successOne: "Bestand angepasst.",
    successMany: (n: number) => `${n} Bestände angepasst.`,
    micLabel: "Bestand per Sprache setzen",
  },
  order: {
    successOne: "Bestellung angepasst.",
    successMany: (n: number) => `${n} Positionen zur Bestellung hinzugefügt.`,
    micLabel: "Bestellung per Sprache hinzufügen",
  },
} as const;

export function InventoryVoiceFab({ mode }: { mode: InventoryVoiceMode }) {
  const copy = COPY[mode];
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { ingredients, isHydrated: ingredientsHydrated, updateIngredient } =
    useIngredientsStorage();
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingLines, setPendingLines] = useState<
    PurchaseOrderVoiceResolvedLine[] | null
  >(null);
  const [heardText, setHeardText] = useState("");
  const [disambiguation, setDisambiguation] =
    useState<PurchaseOrderVoiceAmbiguity | null>(null);
  const pendingItemsRef = useRef<PurchaseOrderVoiceItemInput[]>([]);
  const resolvedLinesRef = useRef<PurchaseOrderVoiceResolvedLine[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dataReady =
    ready &&
    Boolean(restaurantId) &&
    ingredientsHydrated &&
    (mode === "stock" || ordersHydrated) &&
    actorHydrated &&
    suppliers.isHydrated &&
    brands.isHydrated &&
    units.isHydrated;

  const taxonomyCtx = {
    mode,
    ingredients,
    suppliers: suppliers.items,
    brands: brands.items,
    units: units.items,
    getOpenLineContext,
  };

  const openSheet = useCallback((lines: PurchaseOrderVoiceResolvedLine[]) => {
    setPendingLines(lines);
    setSheetOpen(true);
  }, []);

  const continueResolveFromIndex = useCallback(
    (startIndex: number, accumulated: PurchaseOrderVoiceResolvedLine[]) => {
      const items = pendingItemsRef.current;
      const result = resolveInventoryVoiceLines({
        items: items.slice(startIndex),
        ...taxonomyCtx,
      });

      if ("ambiguity" in result && !result.ok) {
        setDisambiguation({
          ...result.ambiguity,
          itemIndex: startIndex + result.ambiguity.itemIndex,
        });
        resolvedLinesRef.current = accumulated;
        return;
      }

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      openSheet([...accumulated, ...result.lines]);
    },
    [openSheet, taxonomyCtx],
  );

  const processVoiceTranscript = useCallback(
    (transcript: string, alternatives: string[] = []) => {
      setHeardText(transcript);
      const parseResult = parsePurchaseOrderVoiceText(transcript);
      if (!parseResult.ok) {
        toast.error(parseResult.error, {
          description: 'Beispiel: „3 Tomaten" oder „Tomaten“ (Menge wird nachgefragt)',
        });
        return;
      }

      const items = buildPurchaseOrderVoiceItems(
        parseResult.parsed,
        alternatives,
      );
      pendingItemsRef.current = items;
      resolvedLinesRef.current = [];

      const result = resolveInventoryVoiceLines({
        items,
        ...taxonomyCtx,
      });

      if ("ambiguity" in result && !result.ok) {
        setDisambiguation(result.ambiguity);
        return;
      }

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      openSheet(result.lines);
    },
    [openSheet, taxonomyCtx],
  );

  const handleFinalTranscript = useCallback(
    (transcript: string, alternatives?: string[]) => {
      processVoiceTranscript(transcript, alternatives ?? []);
    },
    [processVoiceTranscript],
  );

  const handleDisambiguationSelect = useCallback(
    (ingredientId: string) => {
      if (!disambiguation) return;

      const lineResult = resolveInventoryVoiceLineForIngredient({
        ingredientId,
        quantity: disambiguation.quantity,
        quantityExplicit: disambiguation.quantityExplicit,
        ...taxonomyCtx,
      });
      if (!lineResult.ok) {
        if ("error" in lineResult) {
          toast.error(lineResult.error);
        }
        return;
      }

      const nextResolved = [
        ...resolvedLinesRef.current,
        ...lineResult.lines,
      ];
      const nextIndex = disambiguation.itemIndex + 1;
      setDisambiguation(null);

      if (nextIndex >= pendingItemsRef.current.length) {
        openSheet(nextResolved);
        return;
      }

      resolvedLinesRef.current = nextResolved;
      continueResolveFromIndex(nextIndex, nextResolved);
    },
    [continueResolveFromIndex, disambiguation, openSheet, taxonomyCtx],
  );

  const handleSpeechError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    lang: "de-DE",
    onFinal: handleFinalTranscript,
    onError: handleSpeechError,
    silenceFinalizeMs: 2400,
  });

  const toggleListening = () => {
    if (listening) stop("flush");
    else start();
  };

  const handleConfirm = useCallback(
    async (lines: PurchaseOrderVoiceResolvedLine[]) => {
      const result =
        mode === "stock"
          ? await applyInventoryStockVoiceLines({
              lines,
              actor,
              updateIngredient,
            })
          : await applyPurchaseOrderVoiceLines({
              lines,
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
        lines.length === 1
          ? copy.successOne
          : copy.successMany(lines.length),
      );
      setPendingLines(null);
      setHeardText("");
      pendingItemsRef.current = [];
      resolvedLinesRef.current = [];
    },
    [
      actor,
      addLine,
      copy.successMany,
      copy.successOne,
      getOpenLineContext,
      mode,
      updateIngredient,
      updateLineQuantity,
    ],
  );

  if (!mounted || !dataReady || !supported) return null;

  return createPortal(
    <>
      <PurchaseOrderVoiceDisambiguationDialog
        open={disambiguation != null}
        onOpenChange={(open) => {
          if (!open) setDisambiguation(null);
        }}
        heardQuery={disambiguation?.heardQuery ?? ""}
        quantity={disambiguation?.quantity ?? null}
        candidates={disambiguation?.candidates ?? []}
        onSelect={handleDisambiguationSelect}
      />

      <InventoryVoiceConfirmSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setPendingLines(null);
        }}
        mode={mode}
        initialLines={pendingLines}
        heardText={heardText}
        onConfirm={handleConfirm}
      />

      <div
        className={cn(
          "pointer-events-none fixed end-4 z-[120] flex flex-col items-end gap-2 sm:end-6",
          appMobileFabBottomClassName,
        )}
        data-inventory-voice-fab
        data-inventory-voice-mode={mode}
      >
        {listening ? (
          <SpeechLiveCaption listening={listening} interim={interim} />
        ) : null}

        <button
          type="button"
          aria-label={listening ? "Aufnahme beenden" : copy.micLabel}
          aria-pressed={listening}
          className={cn(
            "pointer-events-auto shadow-lg transition-transform active:scale-95",
            appMobileFabButtonClassName,
            brandActionButtonClassName,
            listening && "ring-4 ring-accent/30",
          )}
          onClick={toggleListening}
        >
          {listening ? (
            <Square className={appMobileFabStopIconClassName} aria-hidden />
          ) : (
            <Mic className={appMobileFabIconClassName} strokeWidth={2.25} aria-hidden />
          )}
        </button>
      </div>
    </>,
    document.body,
  );
}
