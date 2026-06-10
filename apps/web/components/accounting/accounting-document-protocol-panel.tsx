"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentsProtocolTableSkeleton } from "@/components/documents/documents-protocol-table-skeleton";
import { TableCellTruncateTooltip } from "@/components/documents/table-cell-truncate-tooltip";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchAccountingDocumentLog } from "@/lib/accounting/accounting-api";
import type {
  AccountingDocumentLogEntry,
  AccountingDocumentLogKind,
} from "@/lib/types/accounting-document-log";
import {
  accountingDocumentLogActionLabel,
  formatAccountingDocumentLogActorLabel,
  formatAccountingDocumentLogSummary,
} from "@/lib/types/accounting-document-log";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string) {
  try {
    return whenFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AccountingDocumentProtocolPanel({
  restaurantId,
  documentKind,
  documentId,
  open,
  refreshToken,
}: {
  restaurantId: string;
  documentKind: AccountingDocumentLogKind;
  documentId: string;
  open: boolean;
  refreshToken?: string | null;
}) {
  const [entries, setEntries] = useState<AccountingDocumentLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    if (!restaurantId || !documentId) return;
    setLoading(true);
    try {
      const rows = await fetchAccountingDocumentLog(
        restaurantId,
        documentKind,
        documentId,
      );
      setEntries(rows);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, documentKind, documentId]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload, refreshToken]);

  return (
    <div className="space-y-2 border-t border-border/50 pt-4">
      <p className="text-sm font-semibold">Protokoll</p>
      {loading && !showSkeleton ? (
        <div className="min-h-24" aria-busy="true" />
      ) : null}
      {showSkeleton ? (
        <DocumentsProtocolTableSkeleton compact />
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Einträge — Aktionen erscheinen hier.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full min-w-[640px] table-fixed text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                <th className="whitespace-nowrap px-2 py-2 sm:px-3">Datum</th>
                <th className="min-w-[7rem] px-2 py-2 sm:px-3">Nutzer</th>
                <th className="min-w-[6rem] px-2 py-2 sm:px-3">Aktion</th>
                <th className="min-w-[12rem] px-2 py-2 sm:px-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground sm:px-3">
                    {formatWhen(entry.created_at)}
                  </td>
                  <td className="max-w-[9rem] whitespace-nowrap px-2 py-2.5 sm:px-3">
                    <TableCellTruncateTooltip
                      text={formatAccountingDocumentLogActorLabel(entry.details)}
                    />
                  </td>
                  <td className="px-2 py-2.5 sm:px-3">
                    {accountingDocumentLogActionLabel(entry.action)}
                  </td>
                  <td className="w-[14rem] px-2 py-2.5 text-muted-foreground sm:px-3">
                    <TableCellTruncateTooltip
                      text={formatAccountingDocumentLogSummary(
                        entry.details,
                        entry.action,
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
