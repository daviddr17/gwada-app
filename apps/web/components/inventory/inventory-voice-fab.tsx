"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import {
  formatParsedPurchaseOrderVoicePreview,
  parsePurchaseOrderVoiceText,
} from "@/lib/inventory/parse-purchase-order-voice-text";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

const COPY = {
  stock: {
    confirmTitle: "Bestand setzen?",
    confirmHint:
      "Bestätigen setzt den Lagerbestand auf die genannte Menge (ersetzt den aktuellen Wert).",
    successOne: "Bestand angepasst.",
    successMany: (n: number) => `${n} Bestände angepasst.`,
    micLabel: "Bestand per Sprache setzen",
  },
  order: {
    confirmTitle: "Zur Bestellung hinzufügen?",
    confirmHint:
      "Bestätigen legt die Mengen in die offene Bestellung — bei vorhandenen Positionen wird die Menge ersetzt, nicht addiert.",
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
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const openConfirm = useCallback((lines: PurchaseOrderVoiceResolvedLine[]) => {
    setPendingLines(lines);
    setConfirmOpen(true);
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

      openConfirm([...accumulated, ...result.lines]);
    },
    [openConfirm, taxonomyCtx],
  );

  const processVoiceTranscript = useCallback(
    (transcript: string, alternatives: string[] = []) => {
      setHeardText(transcript);
      const parseResult = parsePurchaseOrderVoiceText(transcript);
      if (!parseResult.ok) {
        toast.error(parseResult.error, {
          description: 'Beispiel: „3 Tomaten" oder „2 Zwiebeln und 1 Mehl"',
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

      openConfirm(result.lines);
    },
    [openConfirm, taxonomyCtx],
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
        openConfirm(nextResolved);
        return;
      }

      resolvedLinesRef.current = nextResolved;
      continueResolveFromIndex(nextIndex, nextResolved);
    },
    [continueResolveFromIndex, disambiguation, openConfirm, taxonomyCtx],
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

    const result =
      mode === "stock"
        ? await applyInventoryStockVoiceLines({
            lines: pendingLines,
            actor,
            updateIngredient,
          })
        : await applyPurchaseOrderVoiceLines({
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
        ? copy.successOne
        : copy.successMany(pendingLines.length),
    );
    setPendingLines(null);
    setHeardText("");
    pendingItemsRef.current = [];
    resolvedLinesRef.current = [];
  };

  if (!mounted || !dataReady || !supported) return null;

  const preview = pendingLines
    ? formatParsedPurchaseOrderVoicePreview(pendingLines)
    : null;
  const liveCaption = listening ? interim || "Hört zu …" : null;

  return createPortal(
    <>
      <PurchaseOrderVoiceDisambiguationDialog
        open={disambiguation != null}
        onOpenChange={(open) => {
          if (!open) setDisambiguation(null);
        }}
        heardQuery={disambiguation?.heardQuery ?? ""}
        quantity={disambiguation?.quantity ?? 1}
        candidates={disambiguation?.candidates ?? []}
        onSelect={handleDisambiguationSelect}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPendingLines(null);
        }}
        title={copy.confirmTitle}
        description={
          <div className="space-y-2 text-sm text-muted-foreground">
            {preview ? (
              <p className="font-medium text-foreground">{preview}</p>
            ) : null}
            {heardText ? (
              <p className="text-xs italic">„{heardText}"</p>
            ) : null}
            <p>{copy.confirmHint}</p>
          </div>
        }
        confirmLabel={mode === "stock" ? "Setzen" : "Hinzufügen"}
        cancelLabel="Abbrechen"
        destructive={false}
        onConfirm={handleConfirm}
      />

      <div
        className="pointer-events-none fixed end-4 z-[120] flex flex-col items-end gap-2 sm:end-6 bottom-[calc(var(--app-mobile-bottom-nav-bar)+max(1.25rem,env(safe-area-inset-bottom)))]"
        data-inventory-voice-fab
        data-inventory-voice-mode={mode}
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
          aria-label={listening ? "Aufnahme beenden" : copy.micLabel}
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
