"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  FileText,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { DocumentProtocolDrawer } from "@/components/documents/document-protocol-drawer";
import { toast } from "sonner";
import { CategoriesManageDrawer } from "@/components/menu/categories-manage-drawer";
import { MenuTaxonomyDrawer } from "@/components/menu/menu-taxonomy-drawer";
import { DocumentFormDrawer } from "@/components/documents/document-form-drawer";
import {
  DocumentsOverviewStorageSkeleton,
  DocumentsOverviewTableSkeleton,
} from "@/components/documents/documents-overview-skeleton";
import { TableCellTruncateTooltip } from "@/components/documents/table-cell-truncate-tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import { SearchableSelect } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  deleteRestaurantDocumentClient,
  restaurantDocumentDownloadUrl,
  updateRestaurantDocumentClient,
  uploadRestaurantDocumentClient,
} from "@/lib/documents/documents-api";
import { trackDashboardFileUpload } from "@/lib/uploads/dashboard-file-upload";
import { validateRestaurantDocumentFile } from "@/lib/documents/validate-restaurant-document-file";
import { formatStorageBytes } from "@/lib/documents/format-storage";
import { WORKSPACE_STORAGE_MODULE_LABELS } from "@/lib/constants/workspace-storage";
import { useDocumentTagsStorage } from "@/lib/hooks/use-document-tags-storage";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchDocumentsForRestaurant,
  fetchDocumentsStorageUsage,
  fetchProfileDisplayNamesByIds,
  formatDocumentUploaderLabel,
} from "@/lib/supabase/documents-db";
import type {
  DocumentTagDefinition,
  RestaurantDocumentRow,
} from "@/lib/types/documents";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { getTagChipVisual } from "@/lib/utils/tag-styles";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { cn } from "@/lib/utils";

type SortKey =
  | "title"
  | "file_name"
  | "tag"
  | "uploader"
  | "size"
  | "created_at";
type SortDir = "asc" | "desc";

const ALL_TAGS_FILTER = "__all__";
const UNTAGGED_FILTER = "__untagged__";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uploadErrorMessage(code: string | undefined): string {
  switch (code) {
    case "storage_quota_exceeded":
      return "Speicherlimit erreicht (max. 1 GB pro Restaurant).";
    case "invalid_file":
      return "Nur PDF, Word, Pages oder CSV (max. 100 MB).";
    default:
      return code ?? "Upload fehlgeschlagen.";
  }
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 text-left text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground transition-colors normal-case",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active ? (
        <span className="text-foreground" aria-hidden>
          {dir === "asc" ? "↑" : "↓"}
        </span>
      ) : null}
    </button>
  );
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
      className={cn("max-w-[10rem] truncate font-normal", visual.className)}
      style={visual.style}
      title={tag.name}
    >
      {tag.name}
    </Badge>
  );
}

export function DocumentsOverview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has: hasPermission } = useRestaurantPermissions();
  const canEditDocumentNotes = hasPermission("documents.notes.edit");
  const documentTags = useDocumentTagsStorage(restaurantId);

  const [rows, setRows] = useState<RestaurantDocumentRow[]>([]);
  const [usage, setUsage] = useState({
    usedBytes: 0,
    quotaBytes: 3 * 1024 * 1024 * 1024,
    documentsBytes: 0,
    galleryBytes: 0,
    newsBytes: 0,
    accountingBytes: 0,
  });
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState(ALL_TAGS_FILTER);
  const [sortKey, setSortKey] = useState<SortKey | null>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [tagSheet, setTagSheet] = useState<
    | { mode: "create" }
    | { mode: "edit"; initial: DocumentTagDefinition }
    | null
  >(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"upload" | "edit">("upload");
  const [editDoc, setEditDoc] = useState<RestaurantDocumentRow | null>(null);
  const [uploadInitialFile, setUploadInitialFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RestaurantDocumentRow | null>(
    null,
  );
  const [uploaderNames, setUploaderNames] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [protocolDoc, setProtocolDoc] = useState<RestaurantDocumentRow | null>(
    null,
  );

  const openUploadDrawer = useCallback((file?: File | null) => {
    setFormMode("upload");
    setEditDoc(null);
    setUploadInitialFile(file ?? null);
    setFormOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    openUploadDrawer();
    const p = new URLSearchParams(searchParams.toString());
    p.delete("new");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, router, pathname, openUploadDrawer]);

  const activeTags = useMemo(
    () => documentTags.items.filter((t) => t.active !== false),
    [documentTags.items],
  );

  const tagFilterOptions = useMemo(
    () => [
      { value: ALL_TAGS_FILTER, label: "Alle Tags" },
      { value: UNTAGGED_FILTER, label: "Ohne Tag" },
      ...activeTags.map((t) => ({
        value: t.id,
        label: t.name,
        leadingColor: t.backgroundColor,
      })),
    ],
    [activeTags],
  );

  const tagDefinitionsForChips = useMemo(
  () =>
      documentTags.items.map((t) => ({
        id: t.id,
        name: t.name,
        active: t.active,
        backgroundColor: t.backgroundColor,
      })),
    [documentTags.items],
  );

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const [docs, storage] = await Promise.all([
      fetchDocumentsForRestaurant(restaurantId),
      fetchDocumentsStorageUsage(restaurantId),
    ]);
    setLoading(false);
    if (docs.error) {
      toast.error(docs.error);
    } else {
      setRows(docs.data);
      const ids = docs.data
        .map((d) => d.uploaded_by)
        .filter((id): id is string => Boolean(id));
      const names = await fetchProfileDisplayNamesByIds(ids);
      setUploaderNames(names);
    }
    if (!storage.error) setUsage(storage.data);
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" || key === "file_name" || key === "tag" ? "asc" : "desc");
    }
  };

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.file_name.toLowerCase().includes(q) ||
          (r.tag?.name.toLowerCase().includes(q) ?? false),
      );
    }
    if (tagFilter === UNTAGGED_FILTER) {
      list = list.filter((r) => !r.tag_id);
    } else if (tagFilter !== ALL_TAGS_FILTER) {
      list = list.filter((r) => r.tag_id === tagFilter);
    }

    const key = sortKey ?? "created_at";
    const dir = sortDir;
    const mul = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case "title":
          cmp = a.title.localeCompare(b.title, "de");
          break;
        case "file_name":
          cmp = a.file_name.localeCompare(b.file_name, "de");
          break;
        case "tag":
          cmp = (a.tag?.name ?? "").localeCompare(b.tag?.name ?? "", "de");
          break;
        case "uploader":
          cmp = formatDocumentUploaderLabel(a.uploaded_by, uploaderNames).localeCompare(
            formatDocumentUploaderLabel(b.uploaded_by, uploaderNames),
            "de",
          );
          break;
        case "size":
          cmp = a.size_bytes - b.size_bytes;
          break;
        case "created_at":
          cmp = a.created_at.localeCompare(b.created_at);
          break;
      }
      return cmp * mul;
    });
  }, [rows, search, tagFilter, sortKey, sortDir, uploaderNames]);

  const totalCount = filteredSorted.length;
  const totalPages = totalPagesFromCount(totalCount, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);

  const paginatedRows = useMemo(() => {
    const from = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return filteredSorted.slice(from, from + LIST_PAGE_SIZE_DEFAULT);
  }, [filteredSorted, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [search, tagFilter]);

  const handlePageFileDrop = useCallback(
    (file: File) => {
      if (formOpen && formMode === "edit") return;
      const err = validateRestaurantDocumentFile(file);
      if (err) {
        toast.error(err);
        return;
      }
      openUploadDrawer(file);
    },
    [formOpen, formMode, openUploadDrawer],
  );

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handlePageDrop = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.stopPropagation();
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) handlePageFileDrop(dropped);
    },
    [handlePageFileDrop],
  );

  const usagePercent = Math.min(
    100,
    usage.quotaBytes > 0 ? (usage.usedBytes / usage.quotaBytes) * 100 : 0,
  );

  const handleTagSave = (
    payload:
      | { name: string; active?: boolean; backgroundColor: string }
      | { id: string; name: string; active: boolean; backgroundColor: string },
  ) => {
    if ("id" in payload) {
      void documentTags.update(payload.id, {
        name: payload.name,
        active: payload.active,
        backgroundColor: payload.backgroundColor,
      });
    } else {
      void documentTags.add(
        payload.name,
        payload.active !== false,
        payload.backgroundColor,
      );
    }
  };

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div
      className="w-full pb-16"
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      <div className="-mx-4 mb-4 flex flex-wrap gap-2 px-4 sm:-mx-6 sm:px-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-border/60"
          onClick={() => setManageTagsOpen(true)}
        >
          <Tags className="size-4" />
          Tags verwalten
        </Button>
      </div>

      {showSkeleton ? (
        <DocumentsOverviewStorageSkeleton />
      ) : (
      <Card className="mb-4 border-border/50 shadow-card">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Belegter Speicher</span>
            <span className="font-medium tabular-nums">
              {formatStorageBytes(usage.usedBytes)}{" "}
              <span className="text-muted-foreground font-normal">
                von {formatStorageBytes(usage.quotaBytes)}
              </span>
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(usagePercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Belegter Speicher"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                usagePercent >= 95
                  ? "bg-destructive"
                  : usagePercent >= 80
                    ? "bg-amber-500"
                    : "bg-accent",
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(
              [
                ["documentsBytes", usage.documentsBytes],
                ["galleryBytes", usage.galleryBytes],
                ["newsBytes", usage.newsBytes],
                ["accountingBytes", usage.accountingBytes],
              ] as const
            )
              .filter(([, bytes]) => bytes > 0)
              .map(([key, bytes]) => (
                <span key={key}>
                  {WORKSPACE_STORAGE_MODULE_LABELS[key]}:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatStorageBytes(bytes)}
                  </span>
                </span>
              ))}
          </div>
        </CardContent>
      </Card>
      )}

      <div className="-mx-4 mb-4 space-y-3 px-4 sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Titel, Dateiname oder Tag …"
              className="h-11 rounded-2xl border-border/50 bg-card pl-10 shadow-none dark:shadow-sm"
            />
          </div>
          <SearchableSelect
            options={tagFilterOptions}
            value={tagFilter}
            onValueChange={setTagFilter}
            placeholder="Tag filtern"
            searchPlaceholder="Tag suchen …"
            aria-label="Nach Tag filtern"
            className="w-full sm:w-[200px]"
          />
        </div>
      </div>

      <div className="-mx-4 mb-6 px-4 sm:-mx-6 sm:px-6">
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => openUploadDrawer()}
        >
          <Plus className="size-4" />
          Neues Dokument
        </Button>
      </div>

      {loading && !showSkeleton ? (
        <div className="min-h-[22rem]" aria-busy="true" />
      ) : null}
      {showSkeleton ? (
        <DocumentsOverviewTableSkeleton />
      ) : filteredSorted.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="size-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? "Noch keine Dokumente. Laden Sie die erste Datei hoch."
                : "Keine Treffer für Suche oder Filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-card overflow-hidden">
          <ListPaginationSurround
            classNameAbove="px-4 pt-4"
            classNameBelow="px-4 pb-4"
            page={currentPage}
            totalPages={totalPages}
            shown={paginatedRows.length}
            totalCount={totalCount}
            itemLabel="Dokumente"
            canPrevious={currentPage > 1}
            canNext={currentPage < totalPages}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="min-w-[10rem] px-4 py-3 text-left font-medium">
                    <SortHeader
                      label="Titel"
                      sortKey="title"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[11rem] max-w-[14rem] px-4 py-3 text-left font-medium">
                    <SortHeader
                      label="Datei"
                      sortKey="file_name"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[7rem] px-4 py-3 text-left font-medium">
                    <SortHeader
                      label="Tag"
                      sortKey="tag"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[8rem] px-4 py-3 text-left font-medium">
                    <SortHeader
                      label="Hochgeladen von"
                      sortKey="uploader"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[5.5rem] px-4 py-3 text-left font-medium">
                    <SortHeader
                      label="Größe"
                      sortKey="size"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="min-w-[9.5rem] px-4 py-3 text-left font-medium">
                    <SortHeader
                      label="Hochgeladen"
                      sortKey="created_at"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="w-[9.25rem] min-w-[9.25rem] shrink-0 px-2 py-3 text-right font-medium">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                  >
                    <td className="max-w-[14rem] truncate px-4 py-3 font-medium">
                      {row.title}
                    </td>
                    <td className="max-w-[14rem] px-4 py-3 text-muted-foreground">
                      <TableCellTruncateTooltip text={row.file_name} />
                    </td>
                    <td className="max-w-[10rem] px-4 py-3">
                      <DocumentTagChip
                        tag={row.tag}
                        definitions={tagDefinitionsForChips}
                      />
                    </td>
                    <td className="max-w-[10rem] truncate px-4 py-3 text-muted-foreground">
                      {formatDocumentUploaderLabel(
                        row.uploaded_by,
                        uploaderNames,
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                      {formatStorageBytes(row.size_bytes)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatWhen(row.created_at)}
                    </td>
                    <td className="w-[9.25rem] min-w-[9.25rem] shrink-0 px-2 py-3">
                      <div className="flex shrink-0 justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Herunterladen"
                          onClick={() => {
                            window.open(
                              restaurantDocumentDownloadUrl({
                                restaurantId,
                                documentId: row.id,
                              }),
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Protokoll ${row.title}`}
                          onClick={() => setProtocolDoc(row)}
                        >
                          <ScrollText className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Bearbeiten"
                          onClick={() => {
                            setFormMode("edit");
                            setEditDoc(row);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Löschen"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </ListPaginationSurround>
        </Card>
      )}

      <CategoriesManageDrawer
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        categories={documentTags.items}
        onReorder={(next) => {
          void documentTags.reorder(next as DocumentTagDefinition[]);
        }}
        onEdit={(row) => {
          const full = documentTags.getById(row.id);
          if (full) {
            setTagSheet({ mode: "edit", initial: full });
          }
          setManageTagsOpen(false);
        }}
        onNew={() => {
          setTagSheet({ mode: "create" });
          setManageTagsOpen(false);
        }}
        copy={{
          title: "Dokument-Tags",
          description:
            "Reihenfolge per Ziehen ändern. Inaktive Tags stehen beim Zuordnen nicht zur Verfügung.",
          newButton: "Neues Tag",
        }}
        rowLeading={(row) => {
          const def = documentTags.getById(row.id);
          const bg = def?.backgroundColor;
          if (!bg || !/^#[0-9A-Fa-f]{6}$/.test(bg)) return null;
          return (
            <span
              className="size-3 shrink-0 rounded-full border border-border/50 shadow-inner"
              style={{ backgroundColor: bg }}
              aria-hidden
            />
          );
        }}
      />

      <MenuTaxonomyDrawer
        open={tagSheet !== null}
        onOpenChange={(o) => {
          if (!o) setTagSheet(null);
        }}
        mode={tagSheet?.mode ?? "create"}
        initial={tagSheet?.mode === "edit" ? tagSheet.initial : null}
        variant="documentTags"
        onSave={handleTagSave}
        onDelete={
          tagSheet?.mode === "edit"
            ? (id) => void documentTags.remove(id)
            : undefined
        }
      />

      <DocumentFormDrawer
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setUploadInitialFile(null);
        }}
        mode={formMode}
        document={editDoc}
        initialFile={uploadInitialFile}
        activeTags={activeTags}
        canEditNotes={canEditDocumentNotes}
        onNotesChanged={() => void reload()}
        onUpload={async ({ file, title, tagId }) => {
          const { documentId, error } = await trackDashboardFileUpload(
            () =>
              uploadRestaurantDocumentClient({
                restaurantId,
                file,
                title,
                tagId,
              }),
            {
              successMessage: "Dokument hochgeladen.",
              errorMessage: uploadErrorMessage,
            },
          );
          if (error) {
            return false;
          }
          if (documentId) {
            await reload();
            return true;
          }
          return false;
        }}
        onSaveEdit={async ({ documentId, title, tagId }) => {
          const { error } = await updateRestaurantDocumentClient({
            restaurantId,
            documentId,
            title,
            tagId,
          });
          if (error) {
            toast.error("Speichern fehlgeschlagen.");
            return false;
          }
          toast.success("Gespeichert");
          await reload();
          return true;
        }}
      />

      <DocumentProtocolDrawer
        open={protocolDoc !== null}
        onOpenChange={(o) => {
          if (!o) setProtocolDoc(null);
        }}
        restaurantId={restaurantId}
        documentId={protocolDoc?.id ?? null}
        documentTitle={protocolDoc?.title ?? ""}
        fileName={protocolDoc?.file_name}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title="Dokument löschen?"
        description={
          deleteTarget ? (
            <>
              „{deleteTarget.title}“ wird dauerhaft entfernt.
            </>
          ) : null
        }
        confirmLabel="Löschen"
        onConfirm={async () => {
          if (!deleteTarget) return;
          const { error } = await deleteRestaurantDocumentClient({
            restaurantId,
            documentId: deleteTarget.id,
          });
          if (error) {
            toast.error(error);
            throw new Error(error);
          }
          toast.success("Dokument gelöscht");
          await reload();
        }}
      />
    </div>
  );
}
