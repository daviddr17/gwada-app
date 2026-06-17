"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { validateAccountingVoucherFile } from "@/lib/accounting/validate-voucher-file";

/** Seitenweites Drag-and-Drop für Beleg-Dateien (PDF/Bild) → Upload-Bottom-Sheet. */
export function useAccountingVoucherPageFileDrop(params: {
  enabled: boolean;
  onFile: (file: File) => void;
  /** Bearbeiten-Sheet offen — Drop ignorieren. */
  blockDrop?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  const resetDrag = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }, []);

  useEffect(() => {
    if (!params.enabled || params.blockDrop) {
      resetDrag();
    }
  }, [params.blockDrop, params.enabled, resetDrag]);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!params.enabled || params.blockDrop) return;
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsDragOver(true);
    },
    [params.enabled, params.blockDrop],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!params.enabled || params.blockDrop) return;
      e.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragOver(false);
      }
    },
    [params.enabled, params.blockDrop],
  );

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
      resetDrag();
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
    [params.enabled, params.blockDrop, params.onFile, resetDrag],
  );

  return {
    isDragOver: params.enabled && !params.blockDrop && isDragOver,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };
}
