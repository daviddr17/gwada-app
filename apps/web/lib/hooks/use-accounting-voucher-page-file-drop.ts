"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { validateAccountingVoucherFile } from "@/lib/accounting/validate-voucher-file";

/** Seitenweites Drag-and-Drop für Beleg-Dateien (PDF/Bild) → Upload-Bottom-Sheet. */
export function useAccountingVoucherPageFileDrop(params: {
  enabled: boolean;
  onFile: (file: File) => void;
  /** Bearbeiten-Sheet offen — Drop ignorieren. */
  blockDrop?: boolean;
}) {
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!params.enabled || params.blockDrop) return;
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    [params.enabled, params.blockDrop],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!params.enabled || params.blockDrop) return;
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.stopPropagation();
      const dropped = e.dataTransfer.files?.[0];
      if (!dropped) return;
      const err = validateAccountingVoucherFile(dropped);
      if (err) {
        toast.error(err);
        return;
      }
      params.onFile(dropped);
    },
    [params.enabled, params.blockDrop, params.onFile],
  );

  return { onDragOver: handleDragOver, onDrop: handleDrop };
}
