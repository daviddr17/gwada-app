"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACCOUNTING_VOUCHER_ALLOWED_LABEL,
  ACCOUNTING_VOUCHER_FILE_ACCEPT,
  validateAccountingVoucherFile,
} from "@/lib/accounting/validate-voucher-file";
import { voucherPreviewMime } from "@/lib/accounting/voucher-display";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { cn } from "@/lib/utils";

function isPdfMime(mime: string | null | undefined) {
  return mime === "application/pdf" || mime?.includes("pdf");
}

function isImageMime(mime: string | null | undefined) {
  return Boolean(mime?.startsWith("image/"));
}

type AccountingVoucherDocumentPanelProps = {
  mode: "upload" | "preview";
  file?: File | null;
  onFileChange?: (file: File | null) => void;
  previewUrl?: string | null;
  previewMime?: string | null;
  fileName?: string | null;
  disabled?: boolean;
  className?: string;
  label?: string;
};

export function AccountingVoucherDocumentPanel({
  mode,
  file = null,
  onFileChange,
  previewUrl = null,
  previewMime = null,
  fileName = null,
  disabled = false,
  className,
  label = "Beleg",
}: AccountingVoucherDocumentPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteBlobUrl, setRemoteBlobUrl] = useState<string | null>(null);
  const [resolvedMime, setResolvedMime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const showRemoteSkeleton = useDeferredSkeleton(remoteLoading);

  const localObjectUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(
    () => () => {
      if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
      setRemoteBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    },
    [localObjectUrl],
  );

  useEffect(() => {
    if (!previewUrl || mode !== "preview" || file) {
      setRemoteLoading(false);
      setRemoteError(null);
      setRemoteBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError(null);
    setResolvedMime(null);

    void fetch(previewUrl, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("no_attachment");
          }
          throw new Error("load_failed");
        }
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setRemoteBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        if (!previewMime && blob.type) {
          setResolvedMime(blob.type);
        } else if (previewMime === "lexoffice/file" && blob.type) {
          setResolvedMime(blob.type);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setRemoteError(
          e instanceof Error && e.message === "no_attachment"
            ? "Kein Beleg-Anhang in Lexware hinterlegt."
            : "Beleg konnte nicht geladen werden.",
        );
        setRemoteBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewUrl, mode, file, previewMime]);

  const applySelectedFile = useCallback(
    (next: File | null) => {
      if (!onFileChange) return;
      if (!next) {
        onFileChange(null);
        return;
      }
      const err = validateAccountingVoucherFile(next);
      if (err) {
        toast.error(err);
        return;
      }
      onFileChange(next);
    },
    [onFileChange],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) applySelectedFile(dropped);
    },
    [applySelectedFile],
  );

  const displayUrl = localObjectUrl ?? remoteBlobUrl;
  const displayMime = file
    ? file.type || null
    : voucherPreviewMime(previewMime) ?? resolvedMime;
  const displayName = file?.name ?? fileName;
  const hasPreview = Boolean(displayUrl);

  const previewFrameClassName =
    "relative min-h-[240px] overflow-hidden rounded-xl border border-border/50 bg-muted/10 lg:min-h-[min(68vh,640px)] lg:h-full";

  const renderPreviewContent = () => {
    if (remoteError) {
      return (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground lg:min-h-[min(68vh,640px)]">
          <FileText className="size-8 opacity-50" />
          {remoteError}
        </div>
      );
    }

    if (showRemoteSkeleton && !file) {
      return <Skeleton className="min-h-[240px] w-full rounded-xl lg:min-h-[min(68vh,640px)]" />;
    }

    if (!displayUrl) return null;

    if (isPdfMime(displayMime)) {
      return (
        <iframe
          title={displayName ?? label}
          src={displayUrl}
          className="h-[min(50vh,520px)] w-full bg-white lg:h-[min(68vh,640px)]"
        />
      );
    }

    if (isImageMime(displayMime)) {
      return (
        <div className="flex min-h-[240px] items-center justify-center bg-muted/20 p-2 lg:min-h-[min(68vh,640px)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt={displayName ?? label}
            className="max-h-[min(50vh,520px)] max-w-full object-contain lg:max-h-[min(64vh,600px)]"
          />
        </div>
      );
    }

    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-4 text-center lg:min-h-[min(68vh,640px)]">
        <FileText className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {displayName ?? "Beleg-Anhang"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          render={
            <a href={displayUrl} target="_blank" rel="noopener noreferrer" />
          }
        >
          Anhang öffnen
        </Button>
      </div>
    );
  };

  if (mode === "preview" && hasPreview) {
    return (
      <div className={cn("space-y-2", className)}>
        <Label className="text-sm font-medium">{label}</Label>
        <div className={previewFrameClassName}>{renderPreviewContent()}</div>
      </div>
    );
  }

  if (mode === "preview" && !hasPreview) {
    return (
      <div className={cn("space-y-2", className)}>
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 text-center text-sm text-muted-foreground">
          Kein Beleg-Anhang vorhanden
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label id="voucher-file-label" className="text-sm font-medium">
        {label}
      </Label>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCOUNTING_VOUCHER_FILE_ACCEPT}
        className="sr-only"
        aria-labelledby="voucher-file-label"
        disabled={disabled}
        onChange={(e) => {
          applySelectedFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {hasPreview ? (
        <div className={cn(previewFrameClassName, "group")}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2 z-10 bg-background/80 text-muted-foreground hover:text-destructive"
            aria-label="Datei entfernen"
            disabled={disabled}
            onClick={() => {
              applySelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            <X className="size-4" />
          </Button>
          {renderPreviewContent()}
          {!disabled ? (
            <div className="border-t border-border/40 bg-muted/20 px-3 py-2 text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => fileInputRef.current?.click()}
              >
                Andere Datei wählen
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          data-vaul-no-drag
          aria-labelledby="voucher-file-label"
          className={cn(
            "relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 lg:min-h-[min(68vh,640px)]",
            isDragOver
              ? "border-accent bg-accent/10"
              : "border-border/60 bg-muted/25 hover:border-border hover:bg-muted/40",
            disabled && "pointer-events-none opacity-60",
          )}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Upload
            className={cn(
              "size-8 shrink-0",
              isDragOver ? "text-accent" : "text-muted-foreground",
            )}
            aria-hidden
          />
          <span className="text-sm font-medium">
            {isDragOver ? "Datei loslassen …" : "Beleg hierher ziehen oder auswählen"}
          </span>
          <span className="text-xs text-muted-foreground">
            {ACCOUNTING_VOUCHER_ALLOWED_LABEL} (max. 50 MB)
          </span>
        </div>
      )}
    </div>
  );
}
