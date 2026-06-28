"use client";

import { useCallback, useEffect, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { DocumentsProtocolTableSkeleton } from "@/components/documents/documents-protocol-table-skeleton";
import { TableCellTruncateTooltip } from "@/components/ui/table-cell-truncate-tooltip";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  fetchDocumentLogEntries,
  resolveDocumentLogEntryActorLabel,
} from "@/lib/supabase/documents-db";
import type { RestaurantDocumentLogEntry } from "@/lib/types/document-log";
import {
  documentLogActionLabel,
  formatDocumentLogDetailsSummary,
} from "@/lib/types/document-log";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { moduleDataTableHeadRowMutedClassName } from "@/lib/ui/module-data-table";

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

type DocumentProtocolDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  documentId: string | null;
  documentTitle: string;
  fileName?: string | null;
};

export function DocumentProtocolDrawer({
  open,
  onOpenChange,
  restaurantId,
  documentId,
  documentTitle,
  fileName,
}: DocumentProtocolDrawerProps) {
  const [entries, setEntries] = useState<RestaurantDocumentLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    if (!restaurantId || !documentId) return;
    setLoading(true);
    const { data, error } = await fetchDocumentLogEntries(
      restaurantId,
      documentId,
    );
    setLoading(false);
    if (error) setEntries([]);
    else setEntries(data);
  }, [restaurantId, documentId]);

  useEffect(() => {
    if (!open || !documentId) return;
    void reload();
  }, [open, documentId, reload]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("wide")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Dokumentenprotokoll
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            {documentTitle}
            {fileName ? (
              <>
                {" "}
                · <span className="text-muted-foreground">{fileName}</span>
              </>
            ) : null}
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName("4-6")}>
          <DrawerFormSection contentPadding="4-6">
          {loading && !showSkeleton ? (
            <div className="min-h-48" aria-busy="true" />
          ) : null}
          {showSkeleton ? (
            <DocumentsProtocolTableSkeleton compact />
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Einträge für dieses Dokument.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full min-w-[720px] table-fixed text-left text-xs sm:text-sm">
                <thead>
                  <tr className={moduleDataTableHeadRowMutedClassName}>
                    <th className="whitespace-nowrap px-2 py-2 sm:px-3">Datum</th>
                    <th className="min-w-[7rem] px-2 py-2 sm:px-3">Nutzer</th>
                    <th className="min-w-[6rem] px-2 py-2 sm:px-3">Aktion</th>
                    <th className="min-w-[12rem] px-2 py-2 sm:px-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground sm:px-3">
                        {formatWhen(e.created_at)}
                      </td>
                      <td className="max-w-[9rem] whitespace-nowrap px-2 py-2.5 sm:px-3">
                        <TableCellTruncateTooltip
                          text={resolveDocumentLogEntryActorLabel(e)}
                        />
                      </td>
                      <td className="px-2 py-2.5 sm:px-3">
                        {documentLogActionLabel(e.action)}
                      </td>
                      <td className="w-[14rem] px-2 py-2.5 text-muted-foreground sm:px-3">
                        {e.action === "updated" ||
                        e.action === "note_added" ||
                        e.action === "note_updated" ? (
                          <TableCellTruncateTooltip
                            text={formatDocumentLogDetailsSummary(
                              e.details,
                              e.action,
                            )}
                          />
                        ) : (
                          <TableCellTruncateTooltip
                            text={e.file_name ?? "—"}
                            hideWhenEmpty={false}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </DrawerFormSection>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
