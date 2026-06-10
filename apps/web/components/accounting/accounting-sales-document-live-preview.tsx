"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAccountingSalesDocumentDraftPreview } from "@/lib/accounting/accounting-api";
import {
  ACCOUNTING_PDF_PAGE_HEIGHT_MM,
  ACCOUNTING_PDF_PAGE_WIDTH_MM,
} from "@/lib/accounting/accounting-document-layout";
import type { AccountingSalesDocumentDraftPreviewInput } from "@/lib/accounting/build-sales-document-preview-row";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { cn } from "@/lib/utils";

function PdfPreviewSkeleton() {
  return (
    <div
      className="mx-auto w-full overflow-hidden rounded-lg border border-border/50 bg-white shadow-card"
      style={{
        aspectRatio: `${ACCOUNTING_PDF_PAGE_WIDTH_MM} / ${ACCOUNTING_PDF_PAGE_HEIGHT_MM}`,
      }}
    >
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  );
}

export function AccountingSalesDocumentLivePreview({
  restaurantId,
  kind,
  enabled,
  draft,
  variant = "inline",
}: {
  restaurantId: string;
  kind: "invoice" | "quotation";
  enabled: boolean;
  draft: AccountingSalesDocumentDraftPreviewInput;
  /** `step` = Vorschau-Schritt beim Anlegen (automatisch laden, kein Stale-Hinweis). */
  variant?: "inline" | "step";
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderedDraftKey, setRenderedDraftKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialLoadDoneRef = useRef(false);

  const draftKey = useMemo(() => JSON.stringify(draft), [draft]);
  const kindLabel = kind === "invoice" ? "Rechnung" : "Angebot";
  const isStale = renderedDraftKey !== null && renderedDraftKey !== draftKey;
  const showInitialSkeleton = useDeferredSkeleton(loading && !pdfUrl);

  const loadPreview = useCallback(async () => {
    if (!enabled) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const blob = await fetchAccountingSalesDocumentDraftPreview(
        restaurantId,
        kind,
        draft,
        controller.signal,
      );
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setRenderedDraftKey(draftKey);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError("Vorschau konnte nicht erstellt werden.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [restaurantId, kind, draft, draftKey, enabled]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      initialLoadDoneRef.current = false;
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      setRenderedDraftKey(null);
      setLoading(false);
      return;
    }

    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      void loadPreview();
    }
  }, [enabled, loadPreview]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    },
    [],
  );

  if (!enabled) return null;

  const isStep = variant === "step";

  return (
    <div className="space-y-2">
      {!isStep ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">PDF-Vorschau</p>
            <p className="text-xs text-muted-foreground">
              Layout aus den Einstellungen — nach Änderungen manuell aktualisieren.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            disabled={loading}
            onClick={() => void loadPreview()}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {pdfUrl ? (isStale ? "Aktualisieren" : "Neu laden") : "Vorschau laden"}
          </Button>
        </div>
      ) : null}

      {!isStep && isStale && pdfUrl ? (
        <p className="text-xs text-muted-foreground">
          Formular geändert — Vorschau zeigt noch den letzten Stand.
        </p>
      ) : null}

      {isStep && loading && !pdfUrl ? (
        <p className="text-xs text-muted-foreground">PDF wird erstellt …</p>
      ) : null}

      <div className="relative w-full" aria-busy={loading}>
        {error && !pdfUrl ? (
          <div
            className="flex items-center justify-center rounded-lg border border-border/50 bg-muted/10 px-4 text-center text-sm text-muted-foreground"
            style={{
              aspectRatio: `${ACCOUNTING_PDF_PAGE_WIDTH_MM} / ${ACCOUNTING_PDF_PAGE_HEIGHT_MM}`,
            }}
          >
            {error}
          </div>
        ) : showInitialSkeleton ? (
          <PdfPreviewSkeleton />
        ) : pdfUrl ? (
          <div
            className={cn(
              "overflow-hidden rounded-lg border border-border/50 bg-white shadow-card",
              loading && "opacity-70",
            )}
            style={{
              aspectRatio: `${ACCOUNTING_PDF_PAGE_WIDTH_MM} / ${ACCOUNTING_PDF_PAGE_HEIGHT_MM}`,
            }}
          >
            <iframe
              title={`${kindLabel} PDF-Vorschau`}
              src={pdfUrl}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/10 px-4 text-center text-sm text-muted-foreground"
            style={{
              aspectRatio: `${ACCOUNTING_PDF_PAGE_WIDTH_MM} / ${ACCOUNTING_PDF_PAGE_HEIGHT_MM}`,
            }}
          >
            {loading ? "Vorschau wird erstellt …" : "Vorschau noch nicht geladen."}
          </div>
        )}
      </div>
    </div>
  );
}
