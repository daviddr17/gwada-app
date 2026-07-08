"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
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
    confirmHint: "Bestätigen setzt den Lagerbestand auf die genannte Menge.",
    successOne: "Bestand angepasst.",
    micLabel: "Bestand per Sprache setzen",
    confirmLabel: "Setzen",
  },
  order: {
    confirmTitle: "Zur Bestellung hinzufügen?",
    confirmHint:
      "Bestätigen legt die Mengen in die offene Bestellung — vorhandene Positionen werden ersetzt.",
    successOne: "Bestellung angepasst.",
    micLabel: "Bestellung per Sprache hinzufügen",
    confirmLabel: "Hinzufügen",
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
          description: 'Beispiel: „3 Tomaten" oder „2 Zwiebeln"',
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
        toast.error(lineResult.error);
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

  const { supported, listening, start, stop } = useSpeechRecognition({
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

    const payload = pendingLines.map((line) => ({
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
  };

  if (!mounted || !supported || rows.length === 0) return null;

  const preview = pendingLines
    ? formatParsedPurchaseOrderVoicePreview(pendingLines)
    : null;

  return (
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
        confirmLabel={copy.confirmLabel}
        cancelLabel="Abbrechen"
        destructive={false}
        onConfirm={handleConfirm}
      />

      <Button
        type="button"
        size="lg"
        disabled={disabled || listening}
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
    </>
  );
}
