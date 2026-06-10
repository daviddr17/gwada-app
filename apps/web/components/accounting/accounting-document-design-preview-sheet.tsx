"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAccountingDocumentDesignPreview } from "@/lib/accounting/accounting-api";
import {
  ACCOUNTING_PDF_PAGE_HEIGHT_MM,
  ACCOUNTING_PDF_PAGE_WIDTH_MM,
} from "@/lib/accounting/accounting-document-layout";
import type { AccountingDocumentDesign } from "@/lib/types/accounting-settings";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const KIND_OPTIONS = [
  { value: "invoice", label: "Rechnung" },
  { value: "quotation", label: "Angebot" },
] as const;

function PdfPreviewSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-border/50 bg-white shadow-card"
      style={{
        aspectRatio: `${ACCOUNTING_PDF_PAGE_WIDTH_MM} / ${ACCOUNTING_PDF_PAGE_HEIGHT_MM}`,
      }}
    >
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  );
}

export function AccountingDocumentDesignPreviewSheet({
  open,
  onOpenChange,
  restaurantId,
  documentDesign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  documentDesign: AccountingDocumentDesign;
}) {
  const [kind, setKind] = useState<"invoice" | "quotation">("invoice");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showSkeleton = useDeferredSkeleton(loading);

  const designKey = useMemo(
    () => JSON.stringify(documentDesign),
    [documentDesign],
  );

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const blob = await fetchAccountingDocumentDesignPreview(
        restaurantId,
        documentDesign,
        kind,
      );
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      setError("Vorschau konnte nicht erstellt werden.");
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setLoading(false);
    }
  }, [restaurantId, documentDesign, kind]);

  useEffect(() => {
    if (!open) return;
    void loadPreview();
  }, [open, loadPreview, designKey]);

  useEffect(() => {
    if (!open) {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      setKind("invoice");
    }
  }, [open]);

  const kindLabel = KIND_OPTIONS.find((o) => o.value === kind)?.label ?? "Dokument";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="border-b border-border/50 pb-3 text-left">
          <DrawerTitle>PDF-Vorschau</DrawerTitle>
          <p className="text-sm text-muted-foreground">
            Fertiges Beispiel-PDF mit dem aktuellen Layout — auch ohne Speichern.
            Aktualisiert sich beim Ändern des Layouts.
          </p>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-3">
          <div className="space-y-2">
            <Label>Dokumenttyp</Label>
            <SearchableSelect
              value={kind}
              onValueChange={(v) => setKind(v as "invoice" | "quotation")}
              options={KIND_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              className={appSelectTriggerAccentCn("h-11 w-full max-w-xs")}
              searchPlaceholder="Typ"
              aria-label="Dokumenttyp für Vorschau"
            />
          </div>

          <div
            className="relative mx-auto w-full max-w-xl"
            aria-busy={loading}
          >
            {error ? (
              <div
                className="flex items-center justify-center rounded-lg border border-border/50 bg-muted/10 px-4 text-center text-sm text-muted-foreground"
                style={{
                  aspectRatio: `${ACCOUNTING_PDF_PAGE_WIDTH_MM} / ${ACCOUNTING_PDF_PAGE_HEIGHT_MM}`,
                }}
              >
                {error}
              </div>
            ) : showSkeleton ? (
              <PdfPreviewSkeleton />
            ) : pdfUrl ? (
              <div
                className={cn(
                  "overflow-hidden rounded-lg border border-border/50 bg-white shadow-card",
                  loading && "opacity-60",
                )}
                style={{
                  aspectRatio: `${ACCOUNTING_PDF_PAGE_WIDTH_MM} / ${ACCOUNTING_PDF_PAGE_HEIGHT_MM}`,
                }}
              >
                <iframe
                  title={`${kindLabel} Vorschau`}
                  src={pdfUrl}
                  className="h-full w-full border-0 bg-white"
                />
              </div>
            ) : (
              <div
                className="min-h-0"
                style={{
                  aspectRatio: `${ACCOUNTING_PDF_PAGE_WIDTH_MM} / ${ACCOUNTING_PDF_PAGE_HEIGHT_MM}`,
                }}
              />
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
