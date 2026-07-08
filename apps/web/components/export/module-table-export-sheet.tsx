"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DataExportSheet } from "@/components/export/data-export-sheet";
import {
  downloadTableCsv,
  downloadTablePdf,
} from "@/lib/export/table-document-export";
import {
  resolveModuleTableExport,
  type ModuleTableExportSource,
} from "@/lib/ui/module-table-export";

type ModuleTableExportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportSource: ModuleTableExportSource | null;
  title?: string;
};

export function ModuleTableExportSheet({
  open,
  onOpenChange,
  exportSource,
  title,
}: ModuleTableExportSheetProps) {
  const [resolved, setResolved] = useState<{
    documentTitle: string;
    itemCount: number;
    description: string;
    options: Parameters<typeof downloadTableCsv>[0];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setResolved(null);
      setLoading(false);
      return;
    }
    if (!exportSource) return;

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const options = await resolveModuleTableExport(exportSource);
        if (cancelled) return;
        const count = options.rows.length;
        setResolved({
          documentTitle: options.documentTitle,
          itemCount: count,
          description: options.summaryLine?.trim()
            ? options.summaryLine.trim()
            : `${count} Eintrag${count === 1 ? "" : "e"}`,
          options,
        });
      } catch {
        if (!cancelled) {
          toast.error("Export konnte nicht vorbereitet werden.");
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, exportSource, onOpenChange]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleCsv = () => {
    if (!resolved || resolved.itemCount === 0) return;
    try {
      downloadTableCsv(resolved.options);
      toast.success("CSV wurde heruntergeladen.");
      onOpenChange(false);
    } catch {
      toast.error("CSV-Export fehlgeschlagen.");
    }
  };

  const handlePdf = () => {
    if (!resolved || resolved.itemCount === 0) return;
    void (async () => {
      try {
        await downloadTablePdf(resolved.options);
        toast.success("PDF wurde heruntergeladen.");
        onOpenChange(false);
      } catch {
        toast.error("PDF-Export fehlgeschlagen.");
      }
    })();
  };

  return (
    <DataExportSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title ?? resolved?.documentTitle ?? "Tabelle exportieren"}
      description={
        loading
          ? "Export wird vorbereitet …"
          : (resolved?.description ?? "Noch keine Einträge zum Exportieren.")
      }
      itemCount={loading ? 0 : (resolved?.itemCount ?? 0)}
      onCsv={handleCsv}
      onPdf={handlePdf}
    />
  );
}
