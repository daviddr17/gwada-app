"use client";

import { Mic, Minus, Plus, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import type { InventoryVoiceMode } from "@/lib/inventory/purchase-order-voice-apply";
import {
  inventoryVoiceLinesReadyToApply,
  type PurchaseOrderVoiceResolvedLine,
} from "@/lib/inventory/purchase-order-voice-apply";
import {
  parsePurchaseOrderVoiceQuantityOnly,
  parsePurchaseOrderVoiceText,
} from "@/lib/inventory/parse-purchase-order-voice-text";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { SpeechLiveCaption } from "@/lib/ui/speech-live-caption";
import { isVoiceConfirmUtterance } from "@/lib/voice/voice-confirm-utterance";
import { cn } from "@/lib/utils";

const COPY = {
  stock: {
    titleIncomplete: "Menge für Bestand?",
    titleComplete: "Bestand setzen?",
    hintIncomplete: "Menge nennen oder tippen. Tippen bricht die Sprache ab.",
    hintComplete:
      "Mengen prüfen oder ändern. Sag „Ja“ / „Setzen“ oder tippe Setzen.",
    confirmLabel: "Setzen",
    listenComplete: "„Ja“ hören",
    listenMissing: "Menge sprechen",
  },
  order: {
    titleIncomplete: "Menge für Bestellung?",
    titleComplete: "Zur Bestellung hinzufügen?",
    hintIncomplete: "Menge nennen oder tippen. Tippen bricht die Sprache ab.",
    hintComplete:
      "Mengen prüfen oder ändern. Sag „Ja“ / „Hinzufügen“ oder tippe Hinzufügen.",
    confirmLabel: "Hinzufügen",
    listenComplete: "„Ja“ hören",
    listenMissing: "Menge sprechen",
  },
} as const;

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchLineIndex(
  lines: PurchaseOrderVoiceResolvedLine[],
  articleQuery: string,
): number {
  const q = normalizeName(articleQuery);
  if (!q) return -1;
  const exact = lines.findIndex((l) => normalizeName(l.ingredientName) === q);
  if (exact >= 0) return exact;
  return lines.findIndex((l) => {
    const name = normalizeName(l.ingredientName);
    return name.includes(q) || q.includes(name);
  });
}

type InventoryVoiceConfirmSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InventoryVoiceMode;
  initialLines: PurchaseOrderVoiceResolvedLine[] | null;
  heardText?: string;
  onConfirm: (lines: PurchaseOrderVoiceResolvedLine[]) => Promise<void>;
  autoListen?: boolean;
};

export function InventoryVoiceConfirmSheet({
  open,
  onOpenChange,
  mode,
  initialLines,
  heardText: initialHeardText = "",
  onConfirm,
  autoListen = true,
}: InventoryVoiceConfirmSheetProps) {
  const copy = COPY[mode];
  const [lines, setLines] = useState<PurchaseOrderVoiceResolvedLine[]>([]);
  const [heardText, setHeardText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [speechHint, setSpeechHint] = useState<string | null>(null);
  const typedDuringListenRef = useRef(false);
  const userStoppedRef = useRef(false);
  const openRef = useRef(open);
  const submittingRef = useRef(false);
  const linesRef = useRef<PurchaseOrderVoiceResolvedLine[]>([]);
  const qtyInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  openRef.current = open;
  submittingRef.current = submitting;
  linesRef.current = lines;

  useEffect(() => {
    if (!open || !initialLines) return;
    setLines(initialLines);
    setHeardText(initialHeardText);
    typedDuringListenRef.current = false;
    userStoppedRef.current = false;
    setSpeechHint(null);
  }, [open, initialLines, initialHeardText]);

  const missingQtyIndexes = lines
    .map((line, index) => (line.quantity == null || line.quantity <= 0 ? index : -1))
    .filter((index) => index >= 0);
  const isComplete = inventoryVoiceLinesReadyToApply(lines);
  const canSubmit = isComplete && !submitting;

  const handleSubmitRef = useRef<() => Promise<void>>(async () => {});

  const scheduleRelisten = useCallback((startFn: () => void) => {
    window.setTimeout(() => {
      if (
        typedDuringListenRef.current ||
        userStoppedRef.current ||
        submittingRef.current ||
        !openRef.current
      ) {
        return;
      }
      startFn();
    }, 420);
  }, []);

  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    lang: "de-DE",
    silenceFinalizeMs: isComplete ? 1400 : 2200,
    onError: (message) => setSpeechHint(message),
    onFinal: (transcript, alternatives) => {
      if (submittingRef.current || !openRef.current) return;

      const candidates = [transcript, ...(alternatives ?? [])].filter(Boolean);
      const current = linesRef.current;

      if (inventoryVoiceLinesReadyToApply(current)) {
        if (candidates.some((c) => isVoiceConfirmUtterance(c))) {
          void handleSubmitRef.current();
          return;
        }
      } else if (
        candidates.every(
          (c) => !c.trim() || isVoiceConfirmUtterance(c),
        )
      ) {
        const names = current
          .filter((l) => l.quantity == null || l.quantity <= 0)
          .map((l) => l.ingredientName);
        setSpeechHint(
          names.length > 0
            ? `Noch Menge für: ${names.join(", ")}`
            : "Noch Mengen offen.",
        );
        return;
      }

      let next = [...current];
      let changed = false;

      for (const candidate of candidates) {
        const qtyOnly = parsePurchaseOrderVoiceQuantityOnly(candidate);
        if (qtyOnly != null) {
          const target =
            next.findIndex((l) => l.quantity == null || l.quantity <= 0);
          const index = target >= 0 ? target : next.length === 1 ? 0 : -1;
          if (index >= 0) {
            next[index] = {
              ...next[index]!,
              quantity: qtyOnly,
              quantityExplicit: true,
            };
            changed = true;
            break;
          }
        }

        const parsed = parsePurchaseOrderVoiceText(candidate);
        if (!parsed.ok) continue;
        for (const item of parsed.parsed.items) {
          if (item.quantity == null) continue;
          const index = matchLineIndex(next, item.articleQuery);
          if (index < 0) continue;
          next[index] = {
            ...next[index]!,
            quantity: item.quantity,
            quantityExplicit: true,
          };
          changed = true;
        }
        if (changed) break;
      }

      if (!changed) {
        setSpeechHint(
          inventoryVoiceLinesReadyToApply(current)
            ? 'Nicht erkannt — sag „Ja“ oder tippe die Menge.'
            : "Menge nicht erkannt — z. B. „drei“ oder „2“.",
        );
        scheduleRelisten(start);
        return;
      }

      setLines(next);
      setHeardText((prev) =>
        prev ? `${prev} · ${transcript}` : transcript,
      );

      if (inventoryVoiceLinesReadyToApply(next)) {
        setSpeechHint(
          mode === "stock"
            ? 'Sag „Ja“ oder tippe Setzen.'
            : 'Sag „Ja“ oder tippe Hinzufügen.',
        );
      } else {
        const stillMissing = next
          .filter((l) => l.quantity == null || l.quantity <= 0)
          .map((l) => l.ingredientName);
        setSpeechHint(`Noch Menge für: ${stillMissing.join(", ")}`);
      }

      scheduleRelisten(start);
    },
  });

  const abortSpeechForTyping = useCallback(() => {
    if (!listening) return;
    typedDuringListenRef.current = true;
    userStoppedRef.current = true;
    stop("flush");
  }, [listening, stop]);

  useEffect(() => {
    if (!open || !autoListen || !supported || !initialLines?.length) return;
    const timer = window.setTimeout(() => {
      if (!typedDuringListenRef.current && !userStoppedRef.current) start();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [autoListen, initialLines, open, start, supported]);

  useEffect(() => {
    if (!open || listening || isComplete) return;
    const firstMissing = missingQtyIndexes[0];
    if (firstMissing == null) return;
    const timer = window.setTimeout(() => {
      qtyInputRefs.current[firstMissing]?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, listening]);

  const handleSubmit = useCallback(async () => {
    const ready = linesRef.current;
    if (!inventoryVoiceLinesReadyToApply(ready)) return;
    stop("discard");
    setSubmitting(true);
    try {
      await onConfirm(ready);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [onConfirm, onOpenChange, stop]);

  handleSubmitRef.current = handleSubmit;

  const setQuantityAt = (index: number, quantity: number | null) => {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              quantity,
              quantityExplicit: quantity != null,
            }
          : line,
      ),
    );
  };

  const toggleListen = () => {
    if (listening) {
      userStoppedRef.current = true;
      stop("flush");
      return;
    }
    typedDuringListenRef.current = false;
    userStoppedRef.current = false;
    setSpeechHint(
      isComplete
        ? mode === "stock"
          ? 'Sag „Ja“ oder tippe Setzen.'
          : 'Sag „Ja“ oder tippe Hinzufügen.'
        : null,
    );
    start();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) stop("discard");
        onOpenChange(next);
      }}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto max-h-[92vh] max-w-lg">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-xl">
            {isComplete ? copy.titleComplete : copy.titleIncomplete}
          </DrawerTitle>
          <p className="text-sm text-muted-foreground">
            {isComplete ? copy.hintComplete : copy.hintIncomplete}
          </p>
          {heardText ? (
            <p className="mt-1 text-xs italic text-muted-foreground">
              „{heardText}“
            </p>
          ) : null}
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-2">
          {listening ? (
            <SpeechLiveCaption listening={listening} interim={interim} />
          ) : null}
          {speechHint ? (
            <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {speechHint}
            </p>
          ) : null}

          {lines.map((line, index) => {
            const missing = line.quantity == null || line.quantity <= 0;
            return (
              <div
                key={`${line.ingredientId}-${index}`}
                className="space-y-1.5 rounded-xl border border-border/50 bg-card/40 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Label className="text-base font-medium text-foreground">
                    {line.ingredientName}
                  </Label>
                  {line.unitLabel ? (
                    <span className="text-xs text-muted-foreground">
                      {line.unitLabel}
                    </span>
                  ) : null}
                </div>
                {line.previousQuantity != null && line.previousQuantity > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Bisher {line.previousQuantity}
                    {line.unitLabel ? ` ${line.unitLabel}` : ""}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-12 shrink-0 rounded-xl"
                    aria-label="Weniger"
                    onClick={() => {
                      abortSpeechForTyping();
                      const base = line.quantity ?? 1;
                      setQuantityAt(index, Math.max(0.1, base - 1));
                    }}
                  >
                    <Minus className="size-5" aria-hidden />
                  </Button>
                  <Input
                    ref={(el) => {
                      qtyInputRefs.current[index] = el;
                    }}
                    inputMode="decimal"
                    type="number"
                    min={0.1}
                    step="any"
                    value={line.quantity ?? ""}
                    placeholder="Menge"
                    className={cn(
                      "h-12 rounded-xl text-center text-lg tabular-nums",
                      missing && "border-amber-500/60",
                    )}
                    onFocus={abortSpeechForTyping}
                    onChange={(e) => {
                      abortSpeechForTyping();
                      const raw = e.target.value.trim().replace(",", ".");
                      if (!raw) {
                        setQuantityAt(index, null);
                        return;
                      }
                      const n = Number.parseFloat(raw);
                      setQuantityAt(
                        index,
                        Number.isFinite(n) && n > 0 ? n : null,
                      );
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-12 shrink-0 rounded-xl"
                    aria-label="Mehr"
                    onClick={() => {
                      abortSpeechForTyping();
                      setQuantityAt(index, (line.quantity ?? 0) + 1 || 1);
                    }}
                  >
                    <Plus className="size-5" aria-hidden />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DrawerFooter className="gap-2 sm:flex-row sm:items-center">
          {supported ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 rounded-xl sm:w-auto"
              onClick={toggleListen}
            >
              {listening ? (
                <>
                  <Square className="size-4 fill-current" aria-hidden />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="size-4" aria-hidden />
                  {isComplete ? copy.listenComplete : copy.listenMissing}
                </>
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            className={cn(
              brandActionButtonRoundedClassName,
              "h-12 flex-1 text-base",
            )}
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Speichert…" : copy.confirmLabel}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
