"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AccountingCatalogToolbar } from "@/components/accounting/accounting-catalog-toolbar";
import { AccountingFilterChips } from "@/components/accounting/accounting-filter-chips";
import { AccountingSalesDocumentSheet } from "@/components/accounting/accounting-sales-document-sheet";
import { AccountingSalesDocumentDrawer } from "@/components/accounting/accounting-sales-document-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  createAccountingInvoice,
  createAccountingQuotation,
  fetchAccountingCatalog,
  fetchAccountingInvoices,
  fetchAccountingQuotations,
  fetchAccountingSettings,
  sendSalesDocument,
  syncLexofficeSalesDocuments,
  updateAccountingInvoice,
  updateAccountingQuotation,
} from "@/lib/accounting/accounting-api";
import {
  parseAccountingPlatformFilter,
  type AccountingPlatformFilter,
} from "@/lib/constants/accounting-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useLexofficeContactIntegration } from "@/lib/hooks/use-lexoffice-contact-integration";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type {
  AccountingArticleRow,
  AccountingInvoiceRow,
  AccountingQuotationRow,
  AccountingTaxRateRow,
  AccountingUnitRow,
} from "@/lib/types/accounting";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

type SalesDocumentRow = AccountingInvoiceRow | AccountingQuotationRow;

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  open: "Offen",
  sent: "Verschickt",
  paid: "Bezahlt",
  voided: "Storniert",
  overdue: "Überfällig",
};

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  open: "Offen",
  sent: "Verschickt",
  accepted: "Angenommen",
  rejected: "Abgelehnt",
  voided: "Storniert",
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount);
}

export function AccountingSalesDocumentsScreen({
  documentKind,
}: {
  documentKind: "invoice" | "quotation";
}) {
  const isInvoice = documentKind === "invoice";
  const statusLabels = isInvoice ? INVOICE_STATUS_LABELS : QUOTATION_STATUS_LABELS;
  const addLabel = isInvoice ? "Neue Rechnung" : "Neues Angebot";
  const emptyLabel = isInvoice
    ? "Noch keine Rechnungen — oben anlegen."
    : "Noch keine Angebote — oben anlegen.";
  const countLabel = isInvoice ? "Rechnung" : "Angebot";

  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canManage = has("accounting.manage");
  const lexoffice = useLexofficeContactIntegration(restaurantId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const platformFilter = parseAccountingPlatformFilter(
    searchParams.get("platform"),
  );

  const [rows, setRows] = useState<SalesDocumentRow[]>([]);
  const [taxRates, setTaxRates] = useState<AccountingTaxRateRow[]>([]);
  const [units, setUnits] = useState<AccountingUnitRow[]>([]);
  const [articles, setArticles] = useState<AccountingArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editRow, setEditRow] = useState<SalesDocumentRow | null>(null);
  const [sheetRow, setSheetRow] = useState<SalesDocumentRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const autoSyncDone = useRef(false);

  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const source =
        platformFilter === "all" ? undefined : platformFilter;
      const [list, catalog] = await Promise.all([
        isInvoice
          ? fetchAccountingInvoices(restaurantId, source)
          : fetchAccountingQuotations(restaurantId, source),
        fetchAccountingCatalog(restaurantId),
      ]);
      setRows(list);
      setTaxRates(catalog.taxRates);
      setUnits(catalog.units);
      setArticles(catalog.articles);
    } catch {
      toast.error(
        isInvoice
          ? "Rechnungen konnten nicht geladen werden."
          : "Angebote konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [restaurantId, platformFilter, isInvoice]);

  useEffect(() => {
    void load();
  }, [load]);

  const runLexofficeSync = useCallback(
    async (silent = false) => {
      if (!restaurantId || !lexoffice.connected) return;
      setSyncing(true);
      try {
        const result = await syncLexofficeSalesDocuments(restaurantId, documentKind);
        if (!silent) {
          if (result.listed === 0) {
            toast.message("Lexware: Keine Dokumente gefunden.");
          } else {
            toast.success(
              `Lexware: ${result.imported} neu, ${result.updated} aktualisiert (${result.listed} in Lexware).`,
            );
          }
        }
        await load();
      } catch (e) {
        if (!silent) {
          toast.error(
            e instanceof Error ? e.message : "Lexware-Abruf fehlgeschlagen.",
          );
        }
      } finally {
        setSyncing(false);
      }
    },
    [restaurantId, lexoffice.connected, documentKind, load],
  );

  useEffect(() => {
    if (!restaurantId || !lexoffice.connected || autoSyncDone.current) return;
    autoSyncDone.current = true;
    void (async () => {
      try {
        const { settings } = await fetchAccountingSettings(restaurantId);
        if (settings.auto_sync_lexoffice) {
          await runLexofficeSync(true);
        }
      } catch {
        /* ignore background sync errors */
      }
    })();
  }, [restaurantId, lexoffice.connected, runLexofficeSync]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && canManage) {
      setEditRow(null);
      setDrawerOpen(true);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      router.replace(
        next.toString() ? `${pathname}?${next}` : pathname,
        { scroll: false },
      );
    }
  }, [searchParams, canManage, router, pathname]);

  const selectPlatform = (filter: AccountingPlatformFilter) => {
    const next = new URLSearchParams(searchParams.toString());
    if (filter === "all") next.delete("platform");
    else next.set("platform", filter);
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  };

  const rowCount = useMemo(() => rows.length, [rows]);

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-4">
      {canManage ? (
        <AccountingCatalogToolbar
          restaurantId={restaurantId}
          catalog={{ taxRates, units, articles }}
          onRefresh={() => void load()}
          disabled={loading}
        />
      ) : null}

      <AccountingFilterChips
        filter={platformFilter}
        onFilterChange={selectPlatform}
        lexofficeConnected={lexoffice.connected}
        disabled={loading}
      />

      {canManage && lexoffice.connected ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-border/60"
            disabled={loading || syncing}
            onClick={() => void runLexofficeSync()}
          >
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
            Aus Lexware abrufen
          </Button>
        </div>
      ) : null}

      {canManage ? (
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => {
            setEditRow(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      ) : null}

      {loading && showSkeleton ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="min-h-40 animate-pulse bg-muted/20" />
        </Card>
      ) : (
        <Card className="border-border/50 py-0 shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2">Nummer</th>
                    <th className="px-4 py-2">Datum</th>
                    <th className="px-4 py-2">Empfänger</th>
                    <th className="px-4 py-2">Betrag</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Quelle</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        {emptyLabel}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const recipient =
                        row.recipient_snapshot?.name ?? "—";
                      return (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-b border-border/40 hover:bg-muted/20"
                          onClick={() => {
                            setSheetRow(row);
                            setSheetOpen(true);
                          }}
                        >
                          <td className="px-4 py-3 font-medium">
                            {row.voucher_number ?? "—"}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {new Date(row.voucher_date).toLocaleDateString(
                              "de-DE",
                            )}
                          </td>
                          <td className="px-4 py-3">{recipient}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {formatMoney(
                              row.totals?.totalGross ?? 0,
                              row.currency,
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">
                              {statusLabels[row.status] ?? row.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {row.source === "lexoffice" ? "Lexware" : "Gwada"}
                          </td>
                          <td
                            className="px-4 py-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.source === "lexoffice" &&
                            row.external_edit_url ? (
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
                                In Lexware
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditRow(row);
                                  setDrawerOpen(true);
                                }}
                              >
                                Bearbeiten
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {rowCount > 0 ? (
              <p className="border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
                {rowCount} {countLabel}
                {rowCount === 1 ? "" : isInvoice ? "en" : "e"}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <AccountingSalesDocumentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        documentKind={documentKind}
        restaurantId={restaurantId}
        row={sheetRow}
        canManage={canManage}
        onEdit={() => {
          if (!sheetRow || sheetRow.source === "lexoffice") return;
          setSheetOpen(false);
          setEditRow(sheetRow);
          setDrawerOpen(true);
        }}
        onSent={() => void load()}
      />

      <AccountingSalesDocumentDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        documentKind={documentKind}
        restaurantId={restaurantId}
        editRow={editRow}
        taxRates={taxRates}
        units={units}
        articles={articles}
        lexofficeConnected={lexoffice.connected}
        onSaved={() => {
          void load();
        }}
        onCreate={async (input) => {
          const row = isInvoice
            ? await createAccountingInvoice(restaurantId, input)
            : await createAccountingQuotation(restaurantId, input);
          if (
            input.sendOnSave &&
            (input.sendEmail || input.sendWhatsapp)
          ) {
            try {
              await sendSalesDocument(restaurantId, documentKind, row.id, {
                sendEmail: input.sendEmail,
                sendWhatsapp: input.sendWhatsapp,
              });
              toast.success("Versendet.");
            } catch (e) {
              toast.error(
                e instanceof Error
                  ? e.message
                  : "Angelegt, Versand fehlgeschlagen.",
              );
            }
          }
        }}
        onUpdate={async (id, input) => {
          if (isInvoice) {
            await updateAccountingInvoice(restaurantId, id, input);
          } else {
            await updateAccountingQuotation(restaurantId, id, input);
          }
        }}
      />
    </div>
  );
}
