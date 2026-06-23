"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restaurantDocumentDownloadUrl } from "@/lib/documents/documents-api";

type StaffDocumentPdfPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  documentId: string;
  title: string;
};

export function StaffDocumentPdfPreviewDialog({
  open,
  onOpenChange,
  restaurantId,
  documentId,
  title,
}: StaffDocumentPdfPreviewDialogProps) {
  const src = `${restaurantDocumentDownloadUrl({ restaurantId, documentId })}&inline=1`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-border/50 px-4 py-3">
          <DialogTitle className="truncate text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted/20">
          {open ? (
            <iframe
              title={title}
              src={src}
              className="h-full w-full border-0"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
