"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { TableCellTruncateTooltip } from "@/components/documents/table-cell-truncate-tooltip";
import { DocumentsProtocolTableSkeleton } from "@/components/documents/documents-protocol-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchDocumentLogEntries,
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
  const [entries, setEntries] = useState<RestaurantDocumentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await fetchDocumentLogEntries(restaurantId);
    setLoading(false);
    if (error) toast.error(error);
    else setEntries(data);
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const actor = resolveDocumentLogEntryActorLabel(e).toLowerCase();
      const title = e.document_title.toLowerCase();
      const file = (e.file_name ?? "").toLowerCase();
      const action = documentLogActionLabel(e.action).toLowerCase();
      const details = formatDocumentLogDetailsSummary(
        e.details,
        e.action,
      ).toLowerCase();
      return (
        actor.includes(q) ||
        title.includes(q) ||
        file.includes(q) ||
        action.includes(q) ||
        details.includes(q)
      );
    });
  }, [entries, search]);

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="w-full pb-16">
      <p className="mb-4 text-sm text-muted-foreground">
        Uploads und Änderungen aller Dokumente in diesem Restaurant — wer hat
        wann was hochgeladen oder bearbeitet.
      </p>

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
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {entries.length === 0
              ? "Noch keine Protokolleinträge."
              : "Keine Treffer für die Suche."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/50 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Datum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Nutzer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Dokument
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Datei
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Aktion
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
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
                    <td className="max-w-[12rem] truncate px-4 py-3 font-medium">
                      {e.document_title}
                    </td>
                    <td className="max-w-[10rem] px-4 py-3 text-muted-foreground">
                      <TableCellTruncateTooltip
                        text={e.file_name ?? "—"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {documentLogActionLabel(e.action)}
                    </td>
                    <td className="max-w-[16rem] px-4 py-3 text-muted-foreground">
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
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
