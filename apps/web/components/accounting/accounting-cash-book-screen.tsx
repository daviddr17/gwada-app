"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { AccountingCashCategoryToolbar } from "@/components/accounting/accounting-cash-category-toolbar";
import { AccountingCashEntryDrawer } from "@/components/accounting/accounting-cash-entry-drawer";
import { AccountingCashOpeningBalanceDrawer } from "@/components/accounting/accounting-cash-opening-balance-drawer";
import { AccountingVoucherSheet } from "@/components/accounting/accounting-voucher-sheet";
import { AccountingListSearch } from "@/components/accounting/accounting-list-search";
import { AccountingListTableSkeleton } from "@/components/accounting/accounting-list-screen-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  createAccountingCashEntry,
  deleteAccountingCashEntry,
  fetchAccountingCashBook,
  fetchAccountingCashCategories,
  fetchAccountingCashEntry,
  fetchAccountingCatalog,
  fetchAccountingDocumentStatuses,
  fetchAccountingVoucher,
  saveAccountingCashBookOpeningBalance,
  updateAccountingCashEntry,
} from "@/lib/accounting/accounting-api";
import { formatCashTaxRatesSummary } from "@/lib/accounting/accounting-cash-display";
import { ACCOUNTING_CASH_DIRECTION_LABELS } from "@/lib/accounting/accounting-cash-book-defaults";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  hasModuleCreate,
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type {
  AccountingDocumentStatusRow,
  AccountingTaxRateRow,
  AccountingVoucherRow,
} from "@/lib/types/accounting";
import type {
  AccountingCashBookSummary,
  AccountingCashCategoryRow,
  AccountingCashEntryRow,
} from "@/lib/types/accounting-cash-book";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { cn } from "@/lib/utils";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

function SummaryCard({
  label,
  value,
  tone,
  action,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "accent";
  action?: ReactNode;
}) {
  return (
    <Card className="border-border/50 shadow-card">
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              tone === "positive" && "text-emerald-600 dark:text-emerald-400",
              tone === "negative" && "text-rose-600 dark:text-rose-400",
              tone === "accent" && "text-accent-foreground",
            )}
          >
            {value}
          </p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function AccountingCashBookScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "accounting");
  const canCreate = hasModuleCreate(has, "accounting");
  const canUpdate = hasModuleUpdate(has, "accounting");
  const canManage = canCreate || canUpdate;

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AccountingCashEntryRow[]>([]);
  const [summary, setSummary] = useState<AccountingCashBookSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<AccountingCashCategoryRow[]>([]);
  const [taxRates, setTaxRates] = useState<AccountingTaxRateRow[]>([]);
  const [voucherStatuses, setVoucherStatuses] = useState<
    AccountingDocumentStatusRow[]
  >([]);

  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<AccountingCashEntryRow | null>(
    null,
  );
  const [openingDrawerOpen, setOpeningDrawerOpen] = useState(false);
  const [voucherSheetOpen, setVoucherSheetOpen] = useState(false);
  const [linkedVoucher, setLinkedVoucher] = useState<AccountingVoucherRow | null>(
    null,
  );

  const showSkeleton = useDeferredSkeleton(loading);

  const loadList = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [list, cats, catalog, statuses] = await Promise.all([
        fetchAccountingCashBook(restaurantId, { page, search }),
        fetchAccountingCashCategories(restaurantId),
        fetchAccountingCatalog(restaurantId),
        fetchAccountingDocumentStatuses(restaurantId, "voucher"),
      ]);
      setEntries(list.entries);
      setSummary(list.summary);
      setTotalPages(list.totalPages);
      setTotalCount(list.totalCount);
      setCategories(cats);
      setTaxRates(catalog.taxRates);
      setVoucherStatuses(statuses);
    } catch {
      toast.error("Kassenbuch konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, page, search]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleSearch = (next: string) => {
    setSearch(next);
    setPage(1);
  };

  const openCreate = () => {
    setEditEntry(null);
    setEntryDrawerOpen(true);
  };

  const openEdit = async (entry: AccountingCashEntryRow) => {
    if (!restaurantId) return;
    try {
      const full = await fetchAccountingCashEntry(restaurantId, entry.id);
      setEditEntry(full);
      setEntryDrawerOpen(true);
    } catch {
      toast.error("Buchung konnte nicht geladen werden.");
    }
  };

  const openLinkedVoucher = async (voucherId: string) => {
    if (!restaurantId) return;
    try {
      const voucher = await fetchAccountingVoucher(restaurantId, voucherId, {
        enrich: true,
      });
      setLinkedVoucher(voucher);
      setVoucherSheetOpen(true);
    } catch {
      toast.error("Beleg konnte nicht geladen werden.");
    }
  };

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <AccountingCashCategoryToolbar
          restaurantId={restaurantId}
          disabled={loading}
          onRefresh={() => void loadList()}
        />
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Anfangsbestand"
            value={formatMoney(summary.openingBalance)}
            action={
              canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground"
                  aria-label="Anfangsbestand bearbeiten"
                  onClick={() => setOpeningDrawerOpen(true)}
                >
                  <Pencil className="size-4" />
                </Button>
              ) : null
            }
          />
          <SummaryCard
            label="Einnahmen gesamt"
            value={formatMoney(summary.totalIncome)}
            tone="positive"
          />
          <SummaryCard
            label="Ausgaben gesamt"
            value={formatMoney(summary.totalExpense)}
            tone="negative"
          />
          <SummaryCard
            label="Aktueller Bestand"
            value={formatMoney(summary.currentBalance)}
            tone="accent"
          />
        </div>
      ) : null}

      <AccountingListSearch
        value={search}
        onDebouncedChange={handleSearch}
        placeholder="Buchungen durchsuchen …"
        disabled={loading}
      />

      {canManage ? (
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={openCreate}
          disabled={loading}
        >
          <Plus className="size-4" />
          Buchung erfassen
        </Button>
      ) : null}

      {showSkeleton ? (
        <AccountingListTableSkeleton columnCount={7} minTableWidth="880px" />
      ) : (
        <ListPaginationSurround
          classNameAbove="px-4 pt-4"
          classNameBelow="px-4 pb-4"
          page={page}
          totalPages={totalPages}
          shown={entries.length}
          totalCount={totalCount}
          itemLabel="Buchungen"
          canPrevious={page > 1}
          canNext={page < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40">
                  <th className="px-4 py-2 text-left font-medium">Datum</th>
                  <th className="px-4 py-2 text-left font-medium">Richtung</th>
                  <th className="px-4 py-2 text-left font-medium">Art</th>
                  <th className="px-4 py-2 text-right font-medium">Betrag</th>
                  <th className="px-4 py-2 text-right font-medium">MwSt.</th>
                  <th className="px-4 py-2 text-left font-medium">Beleg</th>
                  <th className="px-4 py-2 text-left font-medium">Notiz</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Noch keine Buchungen — Anfangsbestand setzen und erste
                      Buchung erfassen.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={cn(
                        "border-b border-border/40 last:border-0",
                        canManage && "cursor-pointer hover:bg-muted/30",
                      )}
                      onClick={canManage ? () => void openEdit(entry) : undefined}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(entry.entry_date)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full",
                            entry.direction === "income"
                              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                              : "border-rose-500/40 text-rose-700 dark:text-rose-400",
                          )}
                        >
                          {ACCOUNTING_CASH_DIRECTION_LABELS[entry.direction]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{entry.category_name ?? "—"}</td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-medium",
                          entry.direction === "income"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400",
                        )}
                      >
                        {entry.direction === "expense" ? "−" : "+"}
                        {formatMoney(entry.amount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatCashTaxRatesSummary(entry.tax_lines)}
                        {(entry.tax_lines?.length ?? 0) > 1 ? (
                          <span className="mt-0.5 block text-[11px]">
                            {entry.tax_lines!.length} Positionen
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {entry.voucher_id ? (
                          <button
                            type="button"
                            className="max-w-[10rem] truncate text-left text-sm font-medium text-accent hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openLinkedVoucher(entry.voucher_id!);
                            }}
                          >
                            {entry.voucher_number?.trim() ||
                              entry.voucher_contact_name?.trim() ||
                              "Beleg"}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3 text-muted-foreground">
                        {entry.note?.trim() || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ListPaginationSurround>
      )}

      <AccountingCashEntryDrawer
        open={entryDrawerOpen}
        onOpenChange={setEntryDrawerOpen}
        restaurantId={restaurantId}
        initial={editEntry}
        categories={categories}
        taxRates={taxRates}
        onSave={async (payload) => {
          try {
            if (editEntry) {
              await updateAccountingCashEntry(restaurantId, editEntry.id, payload);
              toast.success("Buchung gespeichert.");
            } else {
              await createAccountingCashEntry(restaurantId, payload);
              toast.success("Buchung erfasst.");
            }
            await loadList();
          } catch {
            toast.error("Buchung konnte nicht gespeichert werden.");
          }
        }}
        onDelete={
          editEntry
            ? async (id) => {
                try {
                  await deleteAccountingCashEntry(restaurantId, id);
                  toast.success("Buchung gelöscht.");
                  await loadList();
                } catch {
                  toast.error("Buchung konnte nicht gelöscht werden.");
                }
              }
            : undefined
        }
      />

      {summary ? (
        <AccountingCashOpeningBalanceDrawer
          open={openingDrawerOpen}
          onOpenChange={setOpeningDrawerOpen}
          initialBalance={summary.openingBalance}
          onSave={async (openingBalance) => {
            try {
              await saveAccountingCashBookOpeningBalance(
                restaurantId,
                openingBalance,
              );
              toast.success("Anfangsbestand gespeichert.");
              await loadList();
            } catch {
              toast.error("Anfangsbestand konnte nicht gespeichert werden.");
            }
          }}
        />
      ) : null}

      <AccountingVoucherSheet
        open={voucherSheetOpen}
        onOpenChange={setVoucherSheetOpen}
        restaurantId={restaurantId}
        row={linkedVoucher}
        statuses={voucherStatuses}
        canManage={canManage}
        onEdit={() => setVoucherSheetOpen(false)}
      />
    </div>
  );
}
