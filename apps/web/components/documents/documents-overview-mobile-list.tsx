"use client";

import { Download, Pencil, ScrollText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatStorageBytes } from "@/lib/documents/format-storage";
import type {
  DocumentTagDefinition,
  RestaurantDocumentRow,
} from "@/lib/types/documents";
import { getTagChipVisual } from "@/lib/utils/tag-styles";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DocumentTagChip({
  tag,
  definitions,
}: {
  tag: RestaurantDocumentRow["tag"];
  definitions: DocumentTagDefinition[];
}) {
  if (!tag) {
    return <span className="text-muted-foreground">—</span>;
  }
  const visual = getTagChipVisual(tag.id, definitions);
  return (
    <Badge
      variant="outline"
      className={cn("max-w-[12rem] truncate font-normal", visual.className)}
      style={visual.style}
      title={tag.name}
    >
      {tag.name}
    </Badge>
  );
}

export type DocumentsOverviewMobileListProps = {
  rows: RestaurantDocumentRow[];
  tagDefinitions: DocumentTagDefinition[];
  uploaderLabel: (row: RestaurantDocumentRow) => string;
  onDownload: (row: RestaurantDocumentRow) => void;
  onProtocol: (row: RestaurantDocumentRow) => void;
  onEdit: (row: RestaurantDocumentRow) => void;
  onDelete: (row: RestaurantDocumentRow) => void;
};

/** Mobile-only: Dokumente als Karten ohne Quer-Scroll. */
export function DocumentsOverviewMobileList({
  rows,
  tagDefinitions,
  uploaderLabel,
  onDownload,
  onProtocol,
  onEdit,
  onDelete,
}: DocumentsOverviewMobileListProps) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-2xl border border-border/50 bg-card p-4 shadow-card"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <button
              type="button"
              className="min-w-0 flex-1 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
              onClick={() => onEdit(row)}
              aria-label={`${row.title} bearbeiten`}
            >
              <p className="truncate text-base font-semibold leading-snug">
                {row.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {row.file_name}
              </p>
            </button>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground"
                aria-label="Herunterladen"
                onClick={() => onDownload(row)}
              >
                <Download className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground"
                aria-label={`Protokoll ${row.title}`}
                onClick={() => onProtocol(row)}
              >
                <ScrollText className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground"
                aria-label="Bearbeiten"
                onClick={() => onEdit(row)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground hover:text-destructive"
                aria-label="Löschen"
                onClick={() => onDelete(row)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DocumentTagChip tag={row.tag} definitions={tagDefinitions} />
            <span className="text-xs text-muted-foreground">
              {uploaderLabel(row)}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatStorageBytes(row.size_bytes)} · {formatWhen(row.created_at)}
          </p>
        </li>
      ))}
    </ul>
  );
}
