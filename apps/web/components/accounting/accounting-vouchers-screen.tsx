"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AccountingCatalogToolbar } from "@/components/accounting/accounting-catalog-toolbar";
import { AccountingFilterDrawer } from "@/components/accounting/accounting-filter-drawer";
import { AccountingListSearch } from "@/components/accounting/accounting-list-search";
import { AccountingSourceIcon } from "@/components/accounting/accounting-source-icon";
import { AccountingStatusBadge } from "@/components/accounting/accounting-status-badge";
import { AccountingTableSortHeader } from "@/components/accounting/accounting-table-sort-header";
import {
  AccountingListScreenSkeleton,
  AccountingListTableSkeleton,
} from "@/components/accounting/accounting-list-screen-skeleton";
import { AccountingVoucherDrawer } from "@/components/accounting/accounting-voucher-drawer";
import { AccountingVoucherSheet } from "@/components/accounting/accounting-voucher-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  createAccountingVoucher,
  fetchAccountingCatalog,
  fetchAccountingDocumentStatuses,
  fetchAccountingVouchers,
  syncAccountingDocuments,
  updateAccountingVoucher,
} from "@/lib/accounting/accounting-api";
import { isLexofficeRateLimitError } from "@/lib/accounting/lexoffice-rate-limit";
import { useAccountingListUrl } from "@/lib/hooks/use-accounting-list-url";
import { isDefaultVoucherSort } from "@/lib/accounting/accounting-list-sort";
import { useMarkNotificationModuleReadOnOpen } from "@/lib/hooks/use-mark-notification-module-read-on-open";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useAccountingVoucherPageFileDrop } from "@/lib/hooks/use-accounting-voucher-page-file-drop";
import { useAccountingConnector } from "@/lib/hooks/use-accounting-connector";
import {
  accountingSourceDisplayLabel,
  isExternalAccountingSource,
  isReadOnlyAccountingDocument,
} from "@/lib/accounting/accounting-source";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  hasModuleCreate,
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type {
  AccountingArticleRow,
  AccountingDocumentStatusRow,
  AccountingTaxRateRow,
  AccountingUnitRow,
  AccountingVoucherRow,
} from "@/lib/types/accounting";
import {
  canCreateAccountingCorrection,
  isAccountingCorrectionVariant,
} from "@/lib/accounting/accounting-corrections";
import { formatVoucherTaxRatesSummary } from "@/lib/accounting/voucher-display";
import { ACCOUNTING_VOUCHER_ALLOWED_LABEL } from "@/lib/accounting/validate-voucher-file";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadLabelClassName,
  moduleDataTableHeadRowClassName,
} from "@/lib/ui/module-data-table";
import { cn } from "@/lib/utils";
import { countAccountingListActiveFilters } from "@/lib/constants/accounting-list-filters";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

const KIND_LABELS: Record<string, string> = {
  expense: "Ausgabe",
  purchase: "Einkauf",
  income: "Einnahme",
  sales: "Verkauf",
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function AccountingVouchersScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "accounting");
  const canCreate = hasModuleCreate(has, "accounting");
  const canUpdate = hasModuleUpdate(has, "accounting");
  const canManage = canCreate || canUpdate;
  const { connector } = useAccountingConnector(restaurantId);
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
  } = useAccountingListUrl("voucher");

  const [filterOpen, setFilterOpen] = useState(false);

  const [rows, setRows] = useState<AccountingVoucherRow[]>([]);
  const [statuses, setStatuses] = useState<AccountingDocumentStatusRow[]>([]);
  const [taxRates, setTaxRates] = useState<AccountingTaxRateRow[]>([]);
  const [units, setUnits] = useState<AccountingUnitRow[]>([]);
  const [articles, setArticles] = useState<AccountingArticleRow[]>([]);
  const [listMeta, setListMeta] = useState({
    page: 1,
    totalPages: 1,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploadInitialFile, setUploadInitialFile] = useState<File | null>(null);
  const [editRow, setEditRow] = useState<AccountingVoucherRow | null>(null);
  const [correctionOf, setCorrectionOf] = useState<AccountingVoucherRow | null>(
    null,
  );
  const [sheetRow, setSheetRow] = useState<AccountingVoucherRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const showSkeleton = useDeferredSkeleton(loading);

  useMarkNotificationModuleReadOnOpen(
    "accounting_voucher",
    Boolean(restaurantId && canRead),
  );

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [list, statusRows, catalog] = await Promise.all([
        fetchAccountingVouchers(restaurantId, {
          source: platformFilter === "all" ? undefined : platformFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
          documentVariant: variantFilter === "all" ? undefined : variantFilter,
          voucherKind: voucherKindFilter === "all" ? undefined : voucherKindFilter,
          search,
          page,
          ...(isDefaultVoucherSort(sortKey, sortDir)
            ? {}
            : { sort: sortKey, sortDir }),
        }),
        fetchAccountingDocumentStatuses(restaurantId, "voucher", {
          includeArchived: true,
        }),
        canManage ? fetchAccountingCatalog(restaurantId) : Promise.resolve(null),
      ]);
      setRows(list.items);
      setStatuses(statusRows);
      if (catalog) {
        setTaxRates(catalog.taxRates);
        setUnits(catalog.units);
        setArticles(catalog.articles);
      }
      setListMeta({
        page: list.page,
        totalPages: list.totalPages,
        totalCount: list.totalCount,
      });
      syncPageFromServer(list.page);
    } catch {
      toast.error("Belege konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [
    restaurantId,
    platformFilter,
    statusFilter,
    variantFilter,
    voucherKindFilter,
    search,
    page,
    sortKey,
    sortDir,
    syncPageFromServer,
    canManage,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const runConnectorSync = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }) => {
      if (
        !restaurantId ||
        !connector.connected ||
        !connector.capabilities.canSyncVouchers
      ) {
        return;
      }
      setSyncing(true);
      try {
        const result = await syncAccountingDocuments(restaurantId, {
          scope: "vouchers",
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
            toast.message(`${label}: Keine Belege gefunden.`);
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
    [restaurantId, connector, load],
  );

  const openNewVoucher = useCallback((file?: File | null) => {
    setEditRow(null);
    setCorrectionOf(null);
    setUploadInitialFile(file ?? null);
    setDrawerOpen(true);
  }, []);

  const voucherPageDrop = useAccountingVoucherPageFileDrop({
    enabled: canManage,
    blockDrop: drawerOpen && Boolean(editRow),
    onFile: (file) => openNewVoucher(file),
  });

  const selectPlatform = setPlatformFilter;

  const filterActiveCount = countAccountingListActiveFilters({
    platformFilter,
    statusFilter,
    variantFilter,
    voucherKindFilter,
  });

  const emptyLabel = search.trim()
    ? "Keine Belege für diese Suche."
    : `Noch keine Belege — oben anlegen${connector.connected ? ` oder aus ${connector.displayName} abrufen` : ""}.`;

  const listCountLabel = `Beleg${listMeta.totalCount === 1 ? "" : "e"}`;

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  const showInitialSkeleton = loading && showSkeleton && rows.length === 0;

  return (
    <div
      className="relative space-y-4"
      onDragEnter={voucherPageDrop.onDragEnter}
      onDragLeave={voucherPageDrop.onDragLeave}
      onDragOver={voucherPageDrop.onDragOver}
      onDrop={voucherPageDrop.onDrop}
    >
      {voucherPageDrop.isDragOver ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent bg-accent/10 px-4 text-center"
          aria-hidden
        >
          <span className="text-sm font-medium text-accent">
            Datei loslassen …
          </span>
          <span className="text-xs text-accent/80">
            {ACCOUNTING_VOUCHER_ALLOWED_LABEL} (max. 50 MB)
          </span>
        </div>
      ) : null}
      {showInitialSkeleton ? (
        <AccountingListScreenSkeleton
          columnCount={10}
          minTableWidth="860px"
          ariaLabel="Belege werden geladen"
          showCatalogToolbar={canManage}
          showLexwareSync={
            canManage &&
            connector.connected &&
            connector.capabilities.canSyncVouchers
          }
          showAddButton={canManage}
        />
      ) : (
        <>
      {canManage ? (
        <AccountingCatalogToolbar
          restaurantId={restaurantId}
          catalog={{ taxRates, units, articles }}
          defaultStatusKind="voucher"
          onRefresh={() => void load()}
          disabled={loading}
        />
      ) : null}

      <AccountingListSearch
        value={search}
        onDebouncedChange={setSearchQuery}
        placeholder="Nummer oder Kontakt …"
        disabled={loading}
        hint="Suche in Belegnummer und Kontaktname."
        filterActiveCount={filterActiveCount}
        onFilterClick={() => setFilterOpen(true)}
      />

      <AccountingFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        mode="voucher"
        platformFilter={platformFilter}
        onPlatformFilterChange={selectPlatform}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        variantFilter={variantFilter}
        onVariantFilterChange={setVariantFilter}
        voucherKindFilter={voucherKindFilter}
        onVoucherKindFilterChange={setVoucherKindFilter}
        statuses={statuses}
        connectorConnected={connector.connected}
      />

      {canManage && connector.connected && connector.capabilities.canSyncVouchers ? (
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
          onClick={() => openNewVoucher()}
        >
          <Plus className="size-4" />
          Neuer Beleg
        </Button>
      ) : null}

      {loading && !showSkeleton ? (
        <div aria-busy className="min-h-[28rem] rounded-xl" />
      ) : loading && showSkeleton ? (
        <AccountingListTableSkeleton
          columnCount={10}
          minTableWidth="860px"
          ariaLabel="Belege werden geladen"
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
        >
              <table className="w-full min-w-[860px] text-sm">
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
                      label="Nummer"
                      sortKey="voucher_number"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <AccountingTableSortHeader
                      label="Datum"
                      sortKey="voucher_date"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <AccountingTableSortHeader
                      label="Kontakt"
                      sortKey="contact_name"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <AccountingTableSortHeader
                      label="Art"
                      sortKey="voucher_kind"
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
                    <th className={cn(moduleDataTableHeadCellClassName, "py-2")}>
                      <span className={moduleDataTableHeadLabelClassName}>
                        Steuer
                      </span>
                    </th>
                    <th className={cn(moduleDataTableHeadCellClassName, "py-2")}>
                      <span className={moduleDataTableHeadLabelClassName}>
                        Steuersätze
                      </span>
                    </th>
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
                        colSpan={10}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        {emptyLabel}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-b border-border/40 hover:bg-muted/20"
                        onClick={() => {
                          setSheetRow(row);
                          setSheetOpen(true);
                        }}
                      >
                        <td className="w-12 px-2 py-3">
                          <AccountingSourceIcon source={row.source} />
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {row.voucher_number ?? "—"}
                            {isAccountingCorrectionVariant(row.document_variant) ? (
                              <Badge variant="secondary" className="text-xs">
                                Korrektur
                              </Badge>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {new Date(row.voucher_date).toLocaleDateString("de-DE")}
                        </td>
                        <td className="px-4 py-3">{row.contact_name ?? "—"}</td>
                        <td className="px-4 py-3">
                          {KIND_LABELS[row.voucher_kind] ?? row.voucher_kind}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatMoney(row.total_gross_amount)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatMoney(row.total_tax_amount)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatVoucherTaxRatesSummary(row.voucher_items)}
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
                          ) : canManage ? (
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
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
        </ModulePaginatedDataTable>
      )}
        </>
      )}

      <AccountingVoucherSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        restaurantId={restaurantId}
        row={sheetRow}
        statuses={statuses}
        canManage={canManage}
        onEdit={() => {
          if (!sheetRow || isReadOnlyAccountingDocument(sheetRow.source)) return;
          setSheetOpen(false);
          setEditRow(sheetRow);
          setCorrectionOf(null);
          setDrawerOpen(true);
        }}
        onCreateCorrection={
          sheetRow && canCreateAccountingCorrection(sheetRow.document_variant)
            ? () => {
                if (!sheetRow) return;
                setSheetOpen(false);
                setEditRow(null);
                setCorrectionOf(sheetRow);
                setDrawerOpen(true);
              }
            : undefined
        }
      />

      <AccountingVoucherDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setCorrectionOf(null);
            setUploadInitialFile(null);
          }
        }}
        restaurantId={restaurantId}
        editRow={editRow}
        correctionOf={correctionOf}
        statuses={statuses}
        externalConnectorConnected={connector.connected}
        initialFile={uploadInitialFile}
        onSaved={() => void load()}
        onCreate={async (input, file) => {
          await createAccountingVoucher(restaurantId, input, file);
        }}
        onUpdate={async (id, input) => {
          await updateAccountingVoucher(restaurantId, id, input);
        }}
      />
    </div>
  );
}
