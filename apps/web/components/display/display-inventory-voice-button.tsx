"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InventoryVoiceConfirmSheet } from "@/components/inventory/inventory-voice-confirm-sheet";
import { PurchaseOrderVoiceDisambiguationDialog } from "@/components/inventory/purchase-order-voice-disambiguation-dialog";
import {
  applyDisplayInventoryOrderVoiceLines,
  applyDisplayInventoryStockVoiceLines,
  displayInventoryOpenLineContext,
  displayInventoryRowsToIngredients,
} from "@/lib/display/display-inventory-voice-apply";
import type { DisplayInventoryIngredientRow } from "@/lib/display/display-inventory-server";
import { GWADA_DISPLAY_INVENTORY_REFRESH_EVENT } from "@/lib/display/display-inventory-live-events";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import {
  buildPurchaseOrderVoiceItems,
  inventoryVoiceLinesReadyToApply,
  resolveInventoryVoiceLineForIngredient,
  resolveInventoryVoiceLines,
  type InventoryVoiceMode,
  type PurchaseOrderVoiceAmbiguity,
  type PurchaseOrderVoiceItemInput,
  type PurchaseOrderVoiceResolvedLine,
} from "@/lib/inventory/purchase-order-voice-apply";
import { parsePurchaseOrderVoiceText } from "@/lib/inventory/parse-purchase-order-voice-text";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import { SpeechLiveCaption } from "@/lib/ui/speech-live-caption";
import { cn } from "@/lib/utils";

const COPY = {
  stock: {
    successOne: "Bestand angepasst.",
    micLabel: "Bestand per Sprache setzen",
  },
  order: {
    successOne: "Bestellung angepasst.",
    micLabel: "Bestellung per Sprache hinzufügen",
  },
} as const;

type DisplayInventoryVoiceButtonProps = {
  mode: InventoryVoiceMode;
  rows: DisplayInventoryIngredientRow[];
  disabled?: boolean;
};

export function DisplayInventoryVoiceButton({
  mode,
  rows,
  disabled = false,
}: DisplayInventoryVoiceButtonProps) {
  const copy = COPY[mode];
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

  const ingredients = displayInventoryRowsToIngredients(rows);

  const suppliers = [
    ...new Map(
      rows.map((r) => [r.supplierId, { id: r.supplierId, name: r.supplierName }]),
    ).values(),
  ];
  const brands = [
    ...new Map(
      rows.map((r) => [r.brandId, { id: r.brandId, name: r.brandLabel }]),
    ).values(),
  ];
  const units = [
    ...new Map(
      rows.map((r) => [r.unitId, { id: r.unitId, name: r.unitLabel }]),
    ).values(),
  ];

  const taxonomyCtx = {
    mode,
    ingredients,
    suppliers,
    brands,
    units,
    getOpenLineContext: (supplierId: string, ingredientId: string) =>
      displayInventoryOpenLineContext(rows, supplierId, ingredientId),
  };

  const notifyRefresh = () => {
    window.dispatchEvent(new Event(GWADA_DISPLAY_INVENTORY_REFRESH_EVENT));
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
      if (!inventoryVoiceLinesReadyToApply(lines)) {
        toast.error("Mengen fehlen noch.");
        throw new Error("Mengen fehlen noch.");
      }

      const payload = lines.map((line) => ({
        ingredientId: line.ingredientId,
        quantity: line.quantity,
      }));

      const result =
        mode === "stock"
          ? await applyDisplayInventoryStockVoiceLines(payload)
          : await applyDisplayInventoryOrderVoiceLines(payload);

      if (!result.ok) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      toast.success(copy.successOne);
      notifyRefresh();
      setPendingLines(null);
      setHeardText("");
      pendingItemsRef.current = [];
      resolvedLinesRef.current = [];
    },
    [copy.successOne, mode],
  );

  if (!mounted || !supported || rows.length === 0) return null;

  return (
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

      <Button
        type="button"
        size="lg"
        disabled={disabled}
        className={cn(
          "h-12 w-12 shrink-0 rounded-full px-0",
          brandActionButtonClassName,
          listening && "animate-pulse ring-4 ring-accent/30",
        )}
        aria-label={listening ? "Aufnahme beenden" : copy.micLabel}
        aria-pressed={listening}
        onClick={toggleListening}
      >
        {listening ? (
          <Square className="size-5 fill-current" aria-hidden />
        ) : (
          <Mic className="size-5" strokeWidth={2.25} aria-hidden />
        )}
      </Button>

      {listening && mounted
        ? createPortal(
            <SpeechLiveCaption listening={listening} interim={interim} floating />,
            document.body,
          )
        : null}
    </>
  );
}
