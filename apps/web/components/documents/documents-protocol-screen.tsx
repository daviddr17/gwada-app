"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { TableCellTruncateTooltip } from "@/components/ui/table-cell-truncate-tooltip";
import { DocumentsProtocolTableSkeleton } from "@/components/documents/documents-protocol-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchDocumentLogEntriesPaginated,
  resolveDocumentLogEntryActorLabel,
} from "@/lib/supabase/documents-db";
import type { RestaurantDocumentLogEntry } from "@/lib/types/document-log";
import {
  documentLogActionLabel,
  formatDocumentLogDetailsSummary,
} from "@/lib/types/document-log";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadRowMutedClassName,
} from "@/lib/ui/module-data-table";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import { fetchAllPaginatedItems } from "@/lib/export/fetch-all-paginated";

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

export function DocumentsProtocolScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const [rows, setRows] = useState<RestaurantDocumentLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced]);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const result = await fetchDocumentLogEntriesPaginated(restaurantId, {
      page,
      search: searchDebounced,
    });
    setLoading(false);
    setRows(result.items);
    setPage(result.page);
    setTotalCount(result.totalCount);
    setTotalPages(result.totalPages);
  }, [restaurantId, page, searchDebounced]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hasSearch = searchDebounced.trim().length > 0;

  const tableExport = useCallback(async () => {
    if (!restaurantId) {
      return {
        documentTitle: "Dokumenten-Protokoll",
        filenamePrefix: "dokumente-protokoll",
        headers: ["Datum", "Nutzer", "Dokument", "Datei", "Aktion", "Details"],
        rows: [] as string[][],
        summaryLine: "0 Einträge",
        orientation: "landscape" as const,
      };
    }

    const all = await fetchAllPaginatedItems((page, pageSize) =>
      fetchDocumentLogEntriesPaginated(restaurantId, {
        page,
        pageSize,
        search: searchDebounced,
      }),
    );

    return {
      documentTitle: "Dokumenten-Protokoll",
      filenamePrefix: "dokumente-protokoll",
      headers: ["Datum", "Nutzer", "Dokument", "Datei", "Aktion", "Details"],
      rows: all.map((e) => [
        formatWhen(e.created_at),
        resolveDocumentLogEntryActorLabel(e),
        e.document_title,
        e.file_name ?? "—",
        documentLogActionLabel(e.action),
        e.action === "updated" ||
        e.action === "note_added" ||
        e.action === "note_updated"
          ? formatDocumentLogDetailsSummary(e.details, e.action)
          : "—",
      ]),
      summaryLine: `${all.length} Eintrag${all.length === 1 ? "" : "e"}`,
      orientation: "landscape" as const,
    };
  }, [restaurantId, searchDebounced]);

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="w-full pb-16">
      <div className="relative mb-4 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Dokument, Nutzer, Aktion …"
          className="h-11 rounded-2xl border-border/50 bg-card pl-10 shadow-none dark:shadow-sm"
        />
      </div>

      {loading && !showSkeleton ? (
        <div className="min-h-[22rem]" aria-busy="true" />
      ) : null}
      {showSkeleton ? (
        <DocumentsProtocolTableSkeleton />
      ) : totalCount === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {hasSearch
              ? "Keine Treffer für die Suche."
              : "Noch keine Protokolleinträge."}
          </CardContent>
        </Card>
      ) : (
        <ModulePaginatedDataTable
          page={page}
          totalPages={totalPages}
          shown={rows.length}
          totalCount={totalCount}
          itemLabel="Einträge"
          fullscreenTitle="Protokoll"
          canPrevious={page > 1}
          canNext={page < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          tableExport={tableExport}
        >
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className={moduleDataTableHeadRowMutedClassName}>
                <th className={moduleDataTableHeadCellClassName}>Datum</th>
                <th className={moduleDataTableHeadCellClassName}>Nutzer</th>
                <th className={moduleDataTableHeadCellClassName}>Dokument</th>
                <th className={moduleDataTableHeadCellClassName}>Datei</th>
                <th className={moduleDataTableHeadCellClassName}>Aktion</th>
                <th className={moduleDataTableHeadCellClassName}>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatWhen(e.created_at)}
                  </td>
                  <td className="max-w-[9rem] whitespace-nowrap px-4 py-3">
                    <TableCellTruncateTooltip
                      text={resolveDocumentLogEntryActorLabel(e)}
                    />
                  </td>
                  <td className="max-w-[12rem] px-4 py-3 font-medium">
                    <TableCellTruncateTooltip text={e.document_title} />
                  </td>
                  <td className="max-w-[10rem] px-4 py-3 text-muted-foreground">
                    <TableCellTruncateTooltip text={e.file_name ?? "—"} />
                  </td>
                  <td className="px-4 py-3">{documentLogActionLabel(e.action)}</td>
                  <td className="max-w-[16rem] px-4 py-3 text-muted-foreground">
                    {e.action === "updated" ||
                    e.action === "note_added" ||
                    e.action === "note_updated" ? (
                      <TableCellTruncateTooltip
                        text={formatDocumentLogDetailsSummary(e.details, e.action)}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModulePaginatedDataTable>
      )}
    </div>
  );
}
