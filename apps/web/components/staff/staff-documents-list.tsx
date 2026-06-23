"use client";

import { useRef, useState } from "react";
import { Download, Eye, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffDocumentPdfPreviewDialog } from "@/components/staff/staff-document-pdf-preview-dialog";
import {
  downloadStaffDocument,
  formatStaffDocumentMeta,
  type StaffDocumentListItem,
} from "@/lib/staff/staff-documents-api";

type StaffDocumentsListProps = {
  restaurantId: string;
  documents: readonly StaffDocumentListItem[];
  emptyMessage?: string;
  exportZipUrl?: string | null;
  allowUpload?: boolean;
  onUpload?: (file: File) => Promise<boolean>;
};

export function StaffDocumentsList({
  restaurantId,
  documents,
  emptyMessage = "Keine Dokumente vorhanden.",
  exportZipUrl,
  allowUpload = false,
  onUpload,
}: StaffDocumentsListProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<StaffDocumentListItem | null>(null);
  const [uploadPending, setUploadPending] = useState(false);

  const handleFileChange = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    setUploadPending(true);
    const ok = await onUpload(file);
    setUploadPending(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!ok) return;
  };

  if (documents.length === 0 && !allowUpload) {
    return (
      <p className="rounded-xl border border-border/50 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {exportZipUrl && documents.length > 0 ? (
          <a
            href={exportZipUrl}
            download
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border/60 bg-background px-3 text-sm font-medium transition-colors hover:bg-muted/40"
          >
            <Download className="size-4" />
            Alle als ZIP
          </a>
        ) : null}
        {allowUpload && onUpload ? (
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={(e) => void handleFileChange(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-border/60"
              disabled={uploadPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              {uploadPending ? "Wird hochgeladen …" : "Dokument hochladen"}
            </Button>
          </>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <p className="rounded-xl border border-border/50 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="border-border/50 shadow-card">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/40">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-snug">
                      {doc.title}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {doc.file_name} · {formatStaffDocumentMeta(doc)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {doc.mime_type === "application/pdf" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setPreview(doc)}
                    >
                      <Eye className="size-4" />
                      Vorschau
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() =>
                      downloadStaffDocument({
                        restaurantId,
                        documentId: doc.id,
                      })
                    }
                  >
                    <Download className="size-4" />
                    Download
                  </Button>
                </div>
              </CardHeader>
            </Card>
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
    </>
  );
}
