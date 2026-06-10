"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Pencil, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { AccountingSendSection } from "@/components/accounting/accounting-send-section";
import { AccountingDocumentProtocolPanel } from "@/components/accounting/accounting-document-protocol-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  canCreateAccountingCorrection,
  isAccountingCorrectionVariant,
} from "@/lib/accounting/accounting-corrections";
import {
  salesDocumentPdfUrl,
  sendSalesDocument,
} from "@/lib/accounting/accounting-api";
import { useRestaurantChannelConnections } from "@/lib/hooks/use-restaurant-channel-connections";
import {
  accountingSourceDisplayLabel,
  isReadOnlyAccountingDocument,
} from "@/lib/accounting/accounting-source";
import type {
  AccountingInvoiceRow,
  AccountingQuotationRow,
} from "@/lib/types/accounting";

type SalesDocumentRow = AccountingInvoiceRow | AccountingQuotationRow;

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount);
}

export function AccountingSalesDocumentSheet({
  open,
  onOpenChange,
  documentKind,
  restaurantId,
  row,
  canManage,
  onEdit,
  onCreateCorrection,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentKind: "invoice" | "quotation";
  restaurantId: string;
  row: SalesDocumentRow | null;
  canManage: boolean;
  onEdit?: () => void;
  onCreateCorrection?: () => void;
  onSent?: () => void;
}) {
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sendEnabled, setSendEnabled] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [sending, setSending] = useState(false);

  const { whatsappConnected } = useRestaurantChannelConnections(
    open ? restaurantId : null,
  );

  const label = documentKind === "invoice" ? "Rechnung" : "Angebot";
  const isCorrection =
    isAccountingCorrectionVariant(row?.document_variant) ||
    row?.external_document_type === "credit_note";
  const displayLabel = isCorrection ? "Korrektur" : label;
  const recipient = row?.recipient_snapshot;
  const showCorrectionAction =
    canManage &&
    documentKind === "invoice" &&
    row &&
    canCreateAccountingCorrection(row.document_variant) &&
    onCreateCorrection;

  const pdfSrc = useMemo(() => {
    if (!row) return null;
    return salesDocumentPdfUrl(restaurantId, documentKind, row.id);
  }, [row, restaurantId, documentKind]);

  useEffect(() => {
    if (!open || !pdfSrc) return;
    setPdfLoading(true);
    setPdfError(null);
    void fetch(pdfSrc, { method: "HEAD" })
      .then((res) => {
        if (!res.ok) setPdfError("PDF konnte nicht geladen werden.");
      })
      .catch(() => setPdfError("PDF konnte nicht geladen werden."))
      .finally(() => setPdfLoading(false));
  }, [open, pdfSrc]);

  useEffect(() => {
    if (!open) {
      setSendEnabled(false);
      setSendEmail(false);
      setSendWhatsapp(false);
    }
  }, [open]);

  const handleSend = async () => {
    if (!row) return;
    if (!sendEmail && !sendWhatsapp) {
      toast.error("Mindestens einen Kanal wählen.");
      return;
    }
    setSending(true);
    try {
      const result = await sendSalesDocument(restaurantId, documentKind, row.id, {
        sendEmail,
        sendWhatsapp,
      });
      toast.success(`Versendet via ${result.channels.join(", ")}.`);
      onSent?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Versand fehlgeschlagen.");
    } finally {
      setSending(false);
    }
  };

  if (!row) return null;

  const readOnlyExternal = isReadOnlyAccountingDocument(row.source);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="border-b border-border/50 pb-3 text-left">
          <DrawerTitle className="flex flex-wrap items-center gap-2">
            {displayLabel} {row.voucher_number ?? ""}
            <Badge variant="outline">
              {accountingSourceDisplayLabel(row.source)}
            </Badge>
            {isCorrection ? (
              <Badge variant="secondary">Korrektur</Badge>
            ) : null}
          </DrawerTitle>
          <p className="text-sm text-muted-foreground">
            {recipient?.name ?? "—"} ·{" "}
            {formatMoney(row.totals?.totalGross ?? 0, row.currency)}
          </p>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-3">
          <div className="relative min-h-[40vh] overflow-hidden rounded-xl border border-border/50 bg-muted/10">
            {pdfLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                PDF wird geladen …
              </div>
            ) : pdfError ? (
              <div className="flex min-h-[40vh] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                {pdfError}
                {readOnlyExternal && row.status === "draft" ? (
                  <span className="mt-1 block">
                    Lexware-PDF oft erst ab Status „offen“ verfügbar.
                  </span>
                ) : null}
              </div>
            ) : pdfSrc ? (
              <iframe
                title={`${label} PDF`}
                src={pdfSrc}
                className="h-[min(50vh,520px)] w-full bg-white"
              />
            ) : null}
          </div>

          {canManage ? (
            <AccountingSendSection
              sendEnabled={sendEnabled}
              onSendEnabledChange={setSendEnabled}
              sendEmail={sendEmail}
              onSendEmailChange={setSendEmail}
              sendWhatsapp={sendWhatsapp}
              onSendWhatsappChange={setSendWhatsapp}
              recipientEmail={recipient?.email}
              recipientPhone={recipient?.phone}
              whatsappConnected={whatsappConnected}
              alreadySent={Boolean(row.sent_at)}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canManage && sendEnabled && !row.sent_at ? (
              <Button
                type="button"
                className={brandActionButtonRoundedClassName}
                disabled={sending}
                onClick={() => void handleSend()}
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Jetzt senden
              </Button>
            ) : null}
            {readOnlyExternal && row.external_edit_url ? (
              <Button
                type="button"
                variant="outline"
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
            ) : canManage && !readOnlyExternal && onEdit ? (
              <Button type="button" variant="outline" onClick={onEdit}>
                <Pencil className="size-4" />
                Bearbeiten
              </Button>
            ) : null}
            {showCorrectionAction ? (
              <Button
                type="button"
                variant="outline"
                onClick={onCreateCorrection}
              >
                <RotateCcw className="size-4" />
                Korrektur anlegen
              </Button>
            ) : null}
          </div>

          <AccountingDocumentProtocolPanel
            restaurantId={restaurantId}
            documentKind={documentKind}
            documentId={row.id}
            open={open}
            refreshToken={row.sent_at ?? row.updated_at}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
