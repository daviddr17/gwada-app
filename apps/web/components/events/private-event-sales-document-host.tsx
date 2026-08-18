"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountingSalesDocumentDrawer } from "@/components/accounting/accounting-sales-document-drawer";
import {
  createAccountingInvoice,
  createAccountingQuotation,
  fetchAccountingCatalog,
  fetchAccountingDocumentStatuses,
  updateAccountingInvoice,
  updateAccountingQuotation,
} from "@/lib/accounting/accounting-api";
import { useAccountingConnector } from "@/lib/hooks/use-accounting-connector";
import type {
  AccountingArticleRow,
  AccountingDocumentStatusRow,
  AccountingInvoiceRow,
  AccountingQuotationRow,
  AccountingSalesDocumentInput,
  AccountingTaxRateRow,
  AccountingUnitRow,
} from "@/lib/types/accounting";

type SalesKind = "quotation" | "invoice";

export function PrivateEventSalesDocumentHost({
  restaurantId,
  kind,
  open,
  onOpenChange,
  onCreated,
}: {
  restaurantId: string;
  kind: SalesKind | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (kind: SalesKind, id: string) => void;
}) {
  const { connector } = useAccountingConnector(open ? restaurantId : null);
  const [taxRates, setTaxRates] = useState<AccountingTaxRateRow[]>([]);
  const [units, setUnits] = useState<AccountingUnitRow[]>([]);
  const [articles, setArticles] = useState<AccountingArticleRow[]>([]);
  const [statuses, setStatuses] = useState<AccountingDocumentStatusRow[]>([]);

  useEffect(() => {
    if (!open || !kind || !restaurantId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [catalog, nextStatuses] = await Promise.all([
          fetchAccountingCatalog(restaurantId),
          fetchAccountingDocumentStatuses(restaurantId, kind),
        ]);
        if (cancelled) return;
        setTaxRates(catalog.taxRates);
        setUnits(catalog.units);
        setArticles(catalog.articles);
        setStatuses(nextStatuses);
      } catch {
        if (!cancelled) toast.error("Buchführung konnte nicht geladen werden.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, kind, restaurantId]);

  const onCreate = useCallback(
    async (input: AccountingSalesDocumentInput) => {
      if (!kind) return;
      const row =
        kind === "quotation"
          ? await createAccountingQuotation(restaurantId, input)
          : await createAccountingInvoice(restaurantId, input);
      onCreated(kind, row.id);
      onOpenChange(false);
    },
    [kind, restaurantId, onCreated, onOpenChange],
  );

  const onUpdate = useCallback(
    async (
      id: string,
      input: Partial<AccountingSalesDocumentInput> & { status?: string },
    ) => {
      if (!kind) return;
      if (kind === "quotation") {
        await updateAccountingQuotation(restaurantId, id, input);
      } else {
        await updateAccountingInvoice(restaurantId, id, input);
      }
    },
    [kind, restaurantId],
  );

  if (!kind) return null;

  return (
    <AccountingSalesDocumentDrawer
      open={open}
      onOpenChange={onOpenChange}
      documentKind={kind}
      restaurantId={restaurantId}
      editRow={null}
      taxRates={taxRates}
      units={units}
      articles={articles}
      statuses={statuses}
      externalConnectorConnected={connector.connected}
      onSaved={() => undefined}
      onCreate={onCreate}
      onUpdate={onUpdate}
    />
  );
}

export type { AccountingInvoiceRow, AccountingQuotationRow };
