"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  createSuperadminNewsletter,
  deleteSuperadminNewsletter,
  duplicateSuperadminNewsletter,
  fetchNewsletterSubscriberCount,
  fetchSuperadminNewsletters,
  previewSuperadminNewsletter,
} from "@/lib/superadmin/platform-newsletter-api";
import type { PlatformNewsletter } from "@/lib/types/platform-newsletter";
import { PLATFORM_NEWSLETTER_STATUS_LABELS_DE } from "@/lib/types/platform-newsletter";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  ModulePaginatedDataTable,
} from "@/lib/ui/module-paginated-data-table";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import {
  LIST_PAGE_SIZE_DEFAULT,
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { NewsletterPreviewDrawer } from "@/components/superadmin/newsletter/newsletter-preview-drawer";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function SuperadminNewsletterListScreen({
  templatesOnly,
}: {
  templatesOnly: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<PlatformNewsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading && items.length === 0);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ items: data, error }, countRes] = await Promise.all([
      fetchSuperadminNewsletters({ templates: templatesOnly }),
      fetchNewsletterSubscriberCount(),
    ]);
    if (error) toast.error(error);
    setItems(data);
    setSubscriberCount(countRes.count);
    setLoading(false);
  }, [templatesOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = totalPagesFromCount(items.length, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return items.slice(start, start + LIST_PAGE_SIZE_DEFAULT);
  }, [items, currentPage]);

  const createNew = async () => {
    const res = await createSuperadminNewsletter({
      asTemplate: templatesOnly,
      title: templatesOnly ? "Neue Vorlage" : "Neuer Newsletter",
    });
    if (res.error || !res.id) {
      toast.error(res.error ?? "Anlegen fehlgeschlagen");
      return;
    }
    router.push(`/superadmin/newsletter/${res.id}`);
  };

  const openPreview = async (id: string) => {
    const res = await previewSuperadminNewsletter(id);
    if (res.error || !res.html) {
      toast.error(res.error ?? "Vorschau fehlgeschlagen");
      return;
    }
    setPreviewHtml(res.html);
    setPreviewSubject(res.subject ?? "");
    setPreviewOpen(true);
  };

  if (showSkeleton) {
    return <Skeleton className="mt-2 h-64 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {subscriberCount} Abonnent{subscriberCount === 1 ? "" : "en"} · Versand
        über Platform-SMTP (contact@gwada.app) in Batches
      </p>

      <Button
        type="button"
        size="lg"
        className={modulePrimaryAddButtonFullWidthClassName}
        onClick={() => void createNew()}
      >
        <Plus className="size-4" />
        {templatesOnly ? "Vorlage anlegen" : "Newsletter anlegen"}
      </Button>

      <ModulePaginatedDataTable
        shown={paginated.length}
        totalCount={items.length}
        itemLabel={templatesOnly ? "Vorlagen" : "Newsletter"}
        page={currentPage}
        totalPages={totalPages}
        canPrevious={currentPage > 1}
        canNext={currentPage < totalPages}
        onPrevious={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className={moduleDataTableHeadRowClassName}>
              <th className="px-3 py-2.5 text-left font-medium">Titel</th>
              <th className="px-3 py-2.5 text-left font-medium">Betreff</th>
              {!templatesOnly ? (
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
              ) : null}
              <th className="px-3 py-2.5 text-left font-medium">Aktualisiert</th>
              <th className="w-[8rem] px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={templatesOnly ? 4 : 5}
                  className="px-3 py-8 text-muted-foreground"
                >
                  Noch keine Einträge.
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-border/40 last:border-b-0 hover:bg-muted/30"
                  onClick={() =>
                    router.push(`/superadmin/newsletter/${row.id}`)
                  }
                >
                  <td className="px-3 py-3 font-medium">{row.title}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.subject || "—"}
                  </td>
                  {!templatesOnly ? (
                    <td className="px-3 py-3">
                      {PLATFORM_NEWSLETTER_STATUS_LABELS_DE[row.status]}
                      {row.status === "sending" || row.status === "sent" ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({row.outboxSent}/{row.outboxSent + row.outboxPending + row.outboxFailed})
                        </span>
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatWhen(row.updatedAt)}
                  </td>
                  <td
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        className="rounded-full"
                        title="Vorschau"
                        onClick={() => void openPreview(row.id)}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        className="rounded-full"
                        title={
                          templatesOnly
                            ? "Als Newsletter kopieren"
                            : "Duplizieren"
                        }
                        onClick={() =>
                          void (async () => {
                            const res = await duplicateSuperadminNewsletter(
                              row.id,
                              { asTemplate: false },
                            );
                            if (res.error || !res.id) {
                              toast.error(res.error ?? "Kopieren fehlgeschlagen");
                              return;
                            }
                            toast.success("Kopie erstellt");
                            router.push(`/superadmin/newsletter/${res.id}`);
                          })()
                        }
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        className="rounded-full"
                        title="Löschen"
                        onClick={() =>
                          void (async () => {
                            if (!confirm("Wirklich löschen?")) return;
                            const res = await deleteSuperadminNewsletter(row.id);
                            if (res.error) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success("Gelöscht");
                            void load();
                          })()
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ModulePaginatedDataTable>

      <NewsletterPreviewDrawer
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={previewSubject}
        html={previewHtml}
      />
    </div>
  );
}
