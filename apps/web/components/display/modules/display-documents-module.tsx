"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StaffDocumentPdfPreviewDialog } from "@/components/staff/staff-document-pdf-preview-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import { cn } from "@/lib/utils";

type DisplayDocumentRow = {
  id: string;
  title: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export function DisplayDocumentsModule({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const [documents, setDocuments] = useState<DisplayDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [preview, setPreview] = useState<DisplayDocumentRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/display/documents", { credentials: "include" });
      const json = (await res.json()) as {
        documents?: DisplayDocumentRow[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Laden fehlgeschlagen");
        setDocuments([]);
      } else {
        setDocuments(json.documents ?? []);
      }
    } catch {
      toast.error("Laden fehlgeschlagen");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className={cn(displayModuleContentClassName, "space-y-4")}>
      {showSkeleton ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : documents.length === 0 ? (
        <p className="rounded-xl border border-border/50 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
          Keine Dokumente für dich freigegeben.
        </p>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 shadow-card"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/40">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {doc.file_name}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {doc.mime_type === "application/pdf" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-xl"
                    aria-label="Vorschau"
                    onClick={() => setPreview(doc)}
                  >
                    <Eye className="size-4" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  aria-label="Download"
                  onClick={() => {
                    window.open(
                      `/api/documents/download?restaurantId=${encodeURIComponent(restaurantId)}&documentId=${encodeURIComponent(doc.id)}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  <Download className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview ? (
        <StaffDocumentPdfPreviewDialog
          open={preview !== null}
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          restaurantId={restaurantId}
          documentId={preview.id}
          title={preview.title}
        />
      ) : null}
    </div>
  );
}
