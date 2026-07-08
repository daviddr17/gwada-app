"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AccountingCatalogToolbar } from "@/components/accounting/accounting-catalog-toolbar";
import { AccountingFilterDrawer } from "@/components/accounting/accounting-filter-drawer";
import { AccountingListSearch } from "@/components/accounting/accounting-list-search";
import {
  AccountingListScreenSkeleton,
  AccountingListTableSkeleton,
} from "@/components/accounting/accounting-list-screen-skeleton";
import { AccountingSalesDocumentSheet } from "@/components/accounting/accounting-sales-document-sheet";
import { AccountingSalesDocumentDrawer } from "@/components/accounting/accounting-sales-document-drawer";
import { AccountingTableSortHeader } from "@/components/accounting/accounting-table-sort-header";
import { AccountingSourceIcon } from "@/components/accounting/accounting-source-icon";
import { AccountingStatusBadge } from "@/components/accounting/accounting-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import { ModuleTableStickyBodyCell } from "@/lib/ui/module-table-sticky-column";
import {
  createAccountingInvoice,
  createAccountingQuotation,
  fetchAccountingCatalog,
  fetchAccountingDocumentStatuses,
  fetchAccountingInvoices,
  fetchAccountingQuotations,
  fetchAccountingSettings,
  sendSalesDocument,
  syncAccountingDocuments,
  updateAccountingInvoice,
  updateAccountingQuotation,
} from "@/lib/accounting/accounting-api";
import { isLexofficeRateLimitError } from "@/lib/accounting/lexoffice-rate-limit";
import { accountingStatusLabel } from "@/lib/accounting/accounting-status-labels";
import { fetchAllPaginatedItems } from "@/lib/export/fetch-all-paginated";
import { LIST_PAGE_SIZE_MAX } from "@/lib/constants/list-pagination";
import { useAccountingListUrl } from "@/lib/hooks/use-accounting-list-url";
import { isDefaultSalesDocumentSort } from "@/lib/accounting/accounting-list-sort";
import { useMarkNotificationModuleReadOnOpen } from "@/lib/hooks/use-mark-notification-module-read-on-open";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useAccountingConnector } from "@/lib/hooks/use-accounting-connector";
import {
  accountingSourceDisplayLabel,
  isExternalAccountingSource,
  isReadOnlyAccountingDocument,
} from "@/lib/accounting/accounting-source";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  hasModuleCreate,
  hasModuleDelete,
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type {
  AccountingArticleRow,
  AccountingDocumentStatusRow,
  AccountingInvoiceRow,
  AccountingQuotationRow,
  AccountingTaxRateRow,
  AccountingUnitRow,
} from "@/lib/types/accounting";
import {
  canCreateAccountingCorrection,
  isAccountingCorrectionVariant,
} from "@/lib/accounting/accounting-corrections";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  moduleDataTableHeadRowClassName,
} from "@/lib/ui/module-data-table";
import { countAccountingListActiveFilters } from "@/lib/constants/accounting-list-filters";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

type SalesDocumentRow = AccountingInvoiceRow | AccountingQuotationRow;

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
  const addLabel = isInvoice ? "Neue Rechnung" : "Neues Angebot";
  const emptyLabel = isInvoice
    ? "Noch keine Rechnungen — oben anlegen."
    : "Noch keine Angebote — oben anlegen.";
  const countLabel = isInvoice ? "Rechnung" : "Angebot";

  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "accounting");
  const canCreate = hasModuleCreate(has, "accounting");
  const canUpdate = hasModuleUpdate(has, "accounting");
  const canDelete = hasModuleDelete(has, "accounting");
  const canManage = canCreate || canUpdate;
  const { connector } = useAccountingConnector(restaurantId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const {
    page,
    search,
    platformFilter,
    statusFilter,
    variantFilter,
    voucherKindFilter,
    sortKey,
    sortDir,
    setSearchQuery,
    setPage,
    setPlatformFilter,
    setStatusFilter,
    setVariantFilter,
    setVoucherKindFilter,
    syncPageFromServer,
    toggleSort,
  } = useAccountingListUrl("sales");

  const [filterOpen, setFilterOpen] = useState(false);

  const [rows, setRows] = useState<SalesDocumentRow[]>([]);
  const [listMeta, setListMeta] = useState({
    page: 1,
    totalPages: 1,
    totalCount: 0,
  });
  const [taxRates, setTaxRates] = useState<AccountingTaxRateRow[]>([]);
  const [units, setUnits] = useState<AccountingUnitRow[]>([]);
  const [articles, setArticles] = useState<AccountingArticleRow[]>([]);
  const [statuses, setStatuses] = useState<AccountingDocumentStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editRow, setEditRow] = useState<SalesDocumentRow | null>(null);
  const [correctionOf, setCorrectionOf] = useState<SalesDocumentRow | null>(
    null,
  );
  const [sheetRow, setSheetRow] = useState<SalesDocumentRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const showSkeleton = useDeferredSkeleton(loading);

  useMarkNotificationModuleReadOnOpen(
    isInvoice ? "accounting_invoice" : "accounting_quotation",
    Boolean(restaurantId && canRead),
  );

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const source =
        platformFilter === "all" ? undefined : platformFilter;
      const listParams = {
        source,
        status: statusFilter === "all" ? undefined : statusFilter,
        documentVariant:
          isInvoice && variantFilter !== "all" ? variantFilter : undefined,
        search,
        page,
        ...(isDefaultSalesDocumentSort(sortKey, sortDir)
          ? {}
          : { sort: sortKey, sortDir }),
      };
      const statusKind = isInvoice ? "invoice" : "quotation";
      const [list, catalog, statusRows] = await Promise.all([
        isInvoice
          ? fetchAccountingInvoices(restaurantId, listParams)
          : fetchAccountingQuotations(restaurantId, listParams),
        fetchAccountingCatalog(restaurantId),
        fetchAccountingDocumentStatuses(restaurantId, statusKind, {
          includeArchived: true,
        }),
      ]);
      setRows(list.items);
      setListMeta({
        page: list.page,
        totalPages: list.totalPages,
        totalCount: list.totalCount,
      });
      syncPageFromServer(list.page);
      setTaxRates(catalog.taxRates);
      setUnits(catalog.units);
      setArticles(catalog.articles);
      setStatuses(statusRows);
    } catch {
      toast.error(
        isInvoice
          ? "Rechnungen konnten nicht geladen werden."
          : "Angebote konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    restaurantId,
    platformFilter,
    statusFilter,
    variantFilter,
    search,
    page,
    sortKey,
    sortDir,
    isInvoice,
    syncPageFromServer,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const runConnectorSync = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }) => {
      if (
        !restaurantId ||
        !connector.connected ||
        !connector.capabilities.canSyncSales
      ) {
        return;
      }
      setSyncing(true);
      try {
        const result = await syncAccountingDocuments(restaurantId, {
          scope: "sales",
          kind: documentKind,
          force: opts?.force === true,
        });
        if (result.skipped) {
          if (!opts?.silent && result.rateLimited) {
            toast.message(
              `${connector.displayName}: API-Limit — Anzeige aus dem letzten Stand.`,
            );
          }
          return;
        }
        if (!opts?.silent) {
          const label = connector.displayName;
          if (result.rateLimited) {
            toast.message(
              `${label}: Teilweise aktualisiert (API-Limit). Rest folgt beim nächsten Abruf.`,
            );
          } else if (result.listed === 0) {
            toast.message(`${label}: Keine Dokumente gefunden.`);
          } else {
            toast.success(
              `${label}: ${result.imported} neu, ${result.updated} aktualisiert (${result.listed} in ${label}).`,
            );
          }
        }
        await load();
      } catch (e) {
        const message = e instanceof Error ? e.message : "";
        if (opts?.silent && isLexofficeRateLimitError(message)) {
          return;
        }
        toast.error(
          message || `${connector.displayName}-Abruf fehlgeschlagen.`,
        );
      } finally {
        setSyncing(false);
      }
    },
    [restaurantId, connector, documentKind, load],
  );

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

  const selectPlatform = setPlatformFilter;

  const filterActiveCount = countAccountingListActiveFilters({
    platformFilter,
    statusFilter,
    variantFilter: isInvoice ? variantFilter : undefined,
  });

  const searchEmptyLabel = isInvoice
    ? "Keine Rechnungen für diese Suche."
    : "Keine Angebote für diese Suche.";

  const listCountLabel =
    countLabel + (listMeta.totalCount === 1 ? "" : isInvoice ? "en" : "e");

  const tableExport = useCallback(async () => {
    if (!restaurantId) {
      return {
        documentTitle: isInvoice ? "Rechnungen" : "Angebote",
        filenamePrefix: isInvoice ? "buchhaltung-rechnungen" : "buchhaltung-angebote",
        headers: ["Quelle", "Empfänger", "Datum", "Nummer", "Betrag", "Status"],
        rows: [] as string[][],
        summaryLine: `0 ${listCountLabel}`,
        orientation: "landscape" as const,
      };
    }

    const source = platformFilter === "all" ? undefined : platformFilter;
    const listParams = {
      source,
      status: statusFilter === "all" ? undefined : statusFilter,
      documentVariant:
        isInvoice && variantFilter !== "all" ? variantFilter : undefined,
      search,
      ...(isDefaultSalesDocumentSort(sortKey, sortDir)
        ? {}
        : { sort: sortKey, sortDir }),
    };

    const all = isInvoice
      ? await fetchAllPaginatedItems(
          (page, pageSize) =>
            fetchAccountingInvoices(restaurantId, {
              ...listParams,
              page,
              pageSize,
            }),
          LIST_PAGE_SIZE_MAX,
        )
      : await fetchAllPaginatedItems(
          (page, pageSize) =>
            fetchAccountingQuotations(restaurantId, {
              ...listParams,
              page,
              pageSize,
            }),
          LIST_PAGE_SIZE_MAX,
        );

    return {
      documentTitle: isInvoice ? "Rechnungen" : "Angebote",
      filenamePrefix: isInvoice ? "buchhaltung-rechnungen" : "buchhaltung-angebote",
      headers: ["Quelle", "Empfänger", "Datum", "Nummer", "Betrag", "Status"],
      rows: all.map((row) => {
        const recipient = row.recipient_snapshot?.name ?? "—";
        const number =
          isAccountingCorrectionVariant(row.document_variant) ||
          row.external_document_type === "credit_note"
            ? `${row.voucher_number ?? "—"} (Korrektur)`
            : (row.voucher_number ?? "—");
        return [
          accountingSourceDisplayLabel(row.source),
          recipient,
          new Date(row.voucher_date).toLocaleDateString("de-DE"),
          number,
          formatMoney(row.totals?.totalGross ?? 0, row.currency),
          accountingStatusLabel(row.status, statuses),
        ];
      }),
      summaryLine: `${all.length} ${countLabel}${all.length === 1 ? "" : isInvoice ? "en" : "e"}`,
      orientation: "landscape" as const,
    };
  }, [
    restaurantId,
    isInvoice,
    platformFilter,
    statusFilter,
    variantFilter,
    search,
    sortKey,
    sortDir,
    statuses,
    countLabel,
    listCountLabel,
  ]);

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  const showInitialSkeleton = loading && showSkeleton && rows.length === 0;

  return (
    <div className="space-y-4">
      {showInitialSkeleton ? (
        <AccountingListScreenSkeleton
          columnCount={7}
          minTableWidth="640px"
          ariaLabel={
            isInvoice ? "Rechnungen werden geladen" : "Angebote werden geladen"
          }
          showCatalogToolbar={canManage}
          showLexwareSync={
            canManage &&
            connector.connected &&
            connector.capabilities.canSyncSales
          }
          showAddButton={canManage}
        />
      ) : (
        <>
      {canManage ? (
        <AccountingCatalogToolbar
          restaurantId={restaurantId}
          catalog={{ taxRates, units, articles }}
          defaultStatusKind={isInvoice ? "invoice" : "quotation"}
          onRefresh={() => void load()}
          disabled={loading}
        />
      ) : null}

      <AccountingListSearch
        value={search}
        onDebouncedChange={setSearchQuery}
        placeholder="Nummer oder Empfänger …"
        disabled={loading}
        hint="Suche in Belegnummer und Empfängername."
        filterActiveCount={filterActiveCount}
        onFilterClick={() => setFilterOpen(true)}
      />

      <AccountingFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        mode={isInvoice ? "invoice" : "quotation"}
        platformFilter={platformFilter}
        onPlatformFilterChange={selectPlatform}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        variantFilter={variantFilter}
        onVariantFilterChange={setVariantFilter}
        voucherKindFilter="all"
        onVoucherKindFilterChange={setVoucherKindFilter}
        statuses={statuses}
        connectorConnected={connector.connected}
      />

      {canManage && connector.connected && connector.capabilities.canSyncSales ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-border/60"
            disabled={loading || syncing}
            onClick={() => void runConnectorSync({ force: true })}
          >
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
            Aus {connector.displayName} abrufen
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
            setCorrectionOf(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      ) : null}

      {loading && !showSkeleton ? (
        <div aria-busy className="min-h-[24rem] rounded-xl" />
      ) : loading && showSkeleton ? (
        <AccountingListTableSkeleton
          columnCount={7}
          minTableWidth="640px"
          ariaLabel={
            isInvoice ? "Rechnungen werden geladen" : "Angebote werden geladen"
          }
        />
      ) : (
        <ModulePaginatedDataTable
          page={listMeta.page}
          totalPages={listMeta.totalPages}
          shown={rows.length}
          totalCount={listMeta.totalCount}
          itemLabel={listCountLabel}
          canPrevious={listMeta.page > 1}
          canNext={listMeta.page < listMeta.totalPages}
          busy={loading}
          onPrevious={() => setPage(listMeta.page - 1)}
          onNext={() => setPage(listMeta.page + 1)}
          tableExport={tableExport}
        >
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className={moduleDataTableHeadRowClassName}>
                    <AccountingTableSortHeader
                      label=""
                      ariaLabel="Quelle sortieren"
                      sortKey="source"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                      className="w-12 px-2"
                    />
                    <AccountingTableSortHeader
                      label="Empfänger"
                      sortKey="recipient"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                      stickyIdentityColumn
                    />
                    <AccountingTableSortHeader
                      label="Datum"
                      sortKey="voucher_date"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <AccountingTableSortHeader
                      label="Nummer"
                      sortKey="voucher_number"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <AccountingTableSortHeader
                      label="Betrag"
                      sortKey="amount"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <AccountingTableSortHeader
                      label="Status"
                      sortKey="status"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
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
                        {search.trim() ? searchEmptyLabel : emptyLabel}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const recipient =
                        row.recipient_snapshot?.name ?? "—";
                      return (
                        <tr
                          key={row.id}
                          className="group/tr cursor-pointer border-b border-border/40 hover:bg-muted/20"
                          onClick={() => {
                            setSheetRow(row);
                            setSheetOpen(true);
                          }}
                        >
                          <td className="w-12 px-2 py-3">
                            <AccountingSourceIcon source={row.source} />
                          </td>
                          <ModuleTableStickyBodyCell
                            tone="muted-hover-20"
                            className="px-4 py-3"
                          >
                            {recipient}
                          </ModuleTableStickyBodyCell>
                          <td className="px-4 py-3 tabular-nums">
                            {new Date(row.voucher_date).toLocaleDateString(
                              "de-DE",
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              {row.voucher_number ?? "—"}
                              {isAccountingCorrectionVariant(
                                row.document_variant,
                              ) ||
                              row.external_document_type === "credit_note" ? (
                                <Badge variant="secondary" className="text-xs">
                                  Korrektur
                                </Badge>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {formatMoney(
                              row.totals?.totalGross ?? 0,
                              row.currency,
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <AccountingStatusBadge
                              statusCode={row.status}
                              statuses={statuses}
                            />
                          </td>
                          <td
                            className="px-4 py-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isExternalAccountingSource(row.source) &&
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
                                In {accountingSourceDisplayLabel(row.source)}
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
        </ModulePaginatedDataTable>
      )}
        </>
      )}

      <AccountingSalesDocumentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        documentKind={documentKind}
        restaurantId={restaurantId}
        row={sheetRow}
        canManage={canManage}
        onEdit={() => {
          if (!sheetRow || isReadOnlyAccountingDocument(sheetRow.source)) return;
          setSheetOpen(false);
          setEditRow(sheetRow);
          setCorrectionOf(null);
          setDrawerOpen(true);
        }}
        onCreateCorrection={
          isInvoice && sheetRow && canCreateAccountingCorrection(sheetRow.document_variant)
            ? () => {
                if (!sheetRow) return;
                setSheetOpen(false);
                setEditRow(null);
                setCorrectionOf(sheetRow);
                setDrawerOpen(true);
              }
            : undefined
        }
        onSent={() => void load()}
      />

      <AccountingSalesDocumentDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setCorrectionOf(null);
        }}
        documentKind={documentKind}
        restaurantId={restaurantId}
        editRow={editRow}
        correctionOf={correctionOf}
        taxRates={taxRates}
        units={units}
        articles={articles}
        statuses={statuses}
        externalConnectorConnected={connector.connected}
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
