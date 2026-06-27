"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffDocumentPdfPreviewDialog } from "@/components/staff/staff-document-pdf-preview-dialog";
import { downloadStaffDocument } from "@/lib/staff/staff-documents-api";
import { cn } from "@/lib/utils";

type StaffContractPdfDownloadButtonProps = {
  restaurantId: string;
  documentId: string;
  documentTitle?: string;
  className?: string;
  size?: "sm" | "default";
  fullWidth?: boolean;
};

export function StaffContractPdfDownloadButton({
  restaurantId,
  documentId,
  documentTitle,
  className,
  size = "sm",
  fullWidth = false,
}: StaffContractPdfDownloadButtonProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const title = documentTitle?.trim() || "Vertrag";

  return (
    <>
      <div
        className={cn("flex flex-wrap gap-2", fullWidth && "w-full", className)}
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn("rounded-xl", fullWidth && "min-w-0 flex-1")}
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="size-4" />
          Vorschau
        </Button>
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn("rounded-xl", fullWidth && "min-w-0 flex-1")}
          onClick={() =>
            downloadStaffDocument({ restaurantId, documentId })
          }
        >
          <Download className="size-4" />
          PDF herunterladen
        </Button>
      </div>

      <StaffDocumentPdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        restaurantId={restaurantId}
        documentId={documentId}
        title={title}
      />
    </>
  );
}
