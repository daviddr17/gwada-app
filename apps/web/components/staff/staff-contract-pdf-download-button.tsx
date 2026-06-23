"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadStaffDocument } from "@/lib/staff/staff-documents-api";
import { cn } from "@/lib/utils";

type StaffContractPdfDownloadButtonProps = {
  restaurantId: string;
  documentId: string;
  className?: string;
  size?: "sm" | "default";
  fullWidth?: boolean;
};

export function StaffContractPdfDownloadButton({
  restaurantId,
  documentId,
  className,
  size = "sm",
  fullWidth = false,
}: StaffContractPdfDownloadButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn("rounded-xl", fullWidth && "w-full", className)}
      onClick={(event) => {
        event.stopPropagation();
        downloadStaffDocument({ restaurantId, documentId });
      }}
    >
      <Download className="size-4" />
      PDF herunterladen
    </Button>
  );
}
