"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AccountingFilterChips } from "@/components/accounting/accounting-filter-chips";
import { AccountingVoucherDrawer } from "@/components/accounting/accounting-voucher-drawer";
import { AccountingVoucherSheet } from "@/components/accounting/accounting-voucher-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  createAccountingVoucher,
  fetchAccountingSettings,
  fetchAccountingVouchers,
  syncLexofficeVouchers,
  updateAccountingVoucher,
} from "@/lib/accounting/accounting-api";
import {
  parseAccountingPlatformFilter,
  type AccountingPlatformFilter,
} from "@/lib/constants/accounting-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useLexofficeContactIntegration } from "@/lib/hooks/use-lexoffice-contact-integration";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { AccountingVoucherRow } from "@/lib/types/accounting";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
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

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  open: "Offen",
  unchecked: "Ungeprüft",
  paid: "Bezahlt",
  voided: "Storniert",
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
  const canManage = has("accounting.manage");
  const lexoffice = useLexofficeContactIntegration(restaurantId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const platformFilter = parseAccountingPlatformFilter(
    searchParams.get("platform"),
  );

  const [rows, setRows] = useState<AccountingVoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editRow, setEditRow] = useState<AccountingVoucherRow | null>(null);
  const [sheetRow, setSheetRow] = useState<AccountingVoucherRow | null>(null);
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
      const list = await fetchAccountingVouchers(restaurantId, source);
      setRows(list);
    } catch {
      toast.error("Belege konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, platformFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const runLexofficeSync = useCallback(
    async (silent = false) => {
      if (!restaurantId || !lexoffice.connected) return;
      setSyncing(true);
      try {
        const result = await syncLexofficeVouchers(restaurantId);
        if (!silent) {
          if (result.listed === 0) {
            toast.message("Lexware: Keine Belege gefunden.");
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
    [restaurantId, lexoffice.connected, load],
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
        /* ignore background sync */
      }
    })();
  }, [restaurantId, lexoffice.connected, runLexofficeSync]);

  const selectPlatform = (filter: AccountingPlatformFilter) => {
    const next = new URLSearchParams(searchParams.toString());
    if (filter === "all") next.delete("platform");
    else next.set("platform", filter);
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  };

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-4">
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
          Neuer Beleg
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
                    <th className="px-4 py-2">Kontakt</th>
                    <th className="px-4 py-2">Art</th>
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
                        colSpan={8}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        Noch keine Belege — oben anlegen oder aus Lexware abrufen.
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
                        <td className="px-4 py-3 font-medium">
                          {row.voucher_number ?? "—"}
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
                        <td className="px-4 py-3">
                          <Badge variant="outline">
                            {STATUS_LABELS[row.status] ?? row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {row.source === "lexoffice" ? "Lexware" : "Gwada"}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.source === "lexoffice" && row.external_edit_url ? (
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
            </div>
            {rows.length > 0 ? (
              <p className="border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
                {rows.length} Beleg{rows.length === 1 ? "" : "e"}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <AccountingVoucherSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        restaurantId={restaurantId}
        row={sheetRow}
        canManage={canManage}
        onEdit={() => {
          if (!sheetRow || sheetRow.source === "lexoffice") return;
          setSheetOpen(false);
          setEditRow(sheetRow);
          setDrawerOpen(true);
        }}
      />

      <AccountingVoucherDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        restaurantId={restaurantId}
        editRow={editRow}
        lexofficeConnected={lexoffice.connected}
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
