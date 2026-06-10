"use client";

import { ExternalLink, Pencil, RotateCcw } from "lucide-react";
import { AccountingVoucherDetailsView } from "@/components/accounting/accounting-voucher-details-view";
import { AccountingDocumentProtocolPanel } from "@/components/accounting/accounting-document-protocol-panel";
import { AccountingVoucherDocumentPanel } from "@/components/accounting/accounting-voucher-document-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { accountingVoucherFileUrl } from "@/lib/accounting/accounting-api";
import {
  accountingSourceDisplayLabel,
  isExternalAccountingSource,
} from "@/lib/accounting/accounting-source";
import {
  canCreateAccountingCorrection,
  isAccountingCorrectionVariant,
} from "@/lib/accounting/accounting-corrections";
import { voucherHasAttachment, voucherPreviewMime } from "@/lib/accounting/voucher-display";
import type {
  AccountingDocumentStatusRow,
  AccountingVoucherRow,
} from "@/lib/types/accounting";
import { cn } from "@/lib/utils";

type AccountingVoucherSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  row: AccountingVoucherRow | null;
  statuses: AccountingDocumentStatusRow[];
  canManage: boolean;
  onEdit: () => void;
  onCreateCorrection?: () => void;
};

export function AccountingVoucherSheet({
  open,
  onOpenChange,
  restaurantId,
  row,
  statuses,
  canManage,
  onEdit,
  onCreateCorrection,
}: AccountingVoucherSheetProps) {
  if (!row) return null;

  const hasFile = voucherHasAttachment(row);
  const previewUrl = hasFile
    ? accountingVoucherFileUrl(restaurantId, row.id)
    : null;
  const isCorrection = isAccountingCorrectionVariant(row.document_variant);
  const showCorrectionAction =
    canManage &&
    canCreateAccountingCorrection(row.document_variant) &&
    onCreateCorrection;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden">
        <DrawerHeader className="shrink-0 border-b border-border/50 pb-3 text-left">
          <DrawerTitle className="flex flex-wrap items-center gap-2">
            {row.voucher_number ?? "Beleg ohne Nummer"}
            {isCorrection ? (
              <Badge variant="secondary">Korrektur</Badge>
            ) : null}
          </DrawerTitle>
        </DrawerHeader>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 md:px-6",
            hasFile && "lg:overflow-hidden",
          )}
        >
          <div
            className={cn(
              "space-y-4",
              hasFile &&
                "lg:grid lg:min-h-0 lg:grid-cols-[minmax(280px,42%)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0",
            )}
          >
            {hasFile && previewUrl ? (
              <div className="lg:sticky lg:top-0 lg:max-h-[calc(92dvh-8rem)] lg:overflow-y-auto lg:pr-1">
                <AccountingVoucherDocumentPanel
                  mode="preview"
                  previewUrl={previewUrl}
                  previewMime={voucherPreviewMime(row.mime_type)}
                  fileName={row.file_name}
                  disabled
                  label="Beleg-Anhang"
                />
              </div>
            ) : null}

            <div className="min-h-0 space-y-4 lg:overflow-y-auto lg:max-h-[calc(92dvh-8rem)] lg:pr-1">
              <AccountingVoucherDetailsView row={row} statuses={statuses} />

              <div className="flex flex-wrap gap-2">
                {isExternalAccountingSource(row.source) && row.external_edit_url ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={row.external_edit_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ExternalLink className="size-4" />
                    In {accountingSourceDisplayLabel(row.source)}
                  </Button>
                ) : canManage && row.source === "gwada" ? (
                  <Button type="button" size="sm" onClick={onEdit}>
                    <Pencil className="size-4" />
                    Bearbeiten
                  </Button>
                ) : null}
                {showCorrectionAction ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onCreateCorrection}
                  >
                    <RotateCcw className="size-4" />
                    Korrektur anlegen
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <AccountingDocumentProtocolPanel
            restaurantId={restaurantId}
            documentKind="voucher"
            documentId={row.id}
            open={open}
            refreshToken={row.updated_at}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
