"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SuperadminPaginatedDataTable } from "@/components/superadmin/superadmin-paginated-data-table";
import { SuperadminSearchToolbar } from "@/components/superadmin/superadmin-search-toolbar";
import {
  superadminCellNowrapClass,
  superadminDateCellClass,
} from "@/components/superadmin/superadmin-table-cells";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  billingStatusLabel,
  formatEurFromCents,
} from "@/lib/billing/billing-status-labels";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchSuperadminBillingInvoices,
  type SuperadminBillingInvoiceRow,
} from "@/lib/supabase/platform-superadmin-db";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function invoiceStatusClass(status: string): string {
  if (status === "paid") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (status === "payment_failed" || status === "uncollectible") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (status === "open") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  }
  return "";
}

export function SuperadminBillingInvoicesScreen() {
  const [rows, setRows] = useState<SuperadminBillingInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchSuperadminBillingInvoices(sb);
    if (error) toast.error(error);
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncFromStripe() {
    setSyncing(true);
    try {
      const res = await fetch("/api/superadmin/billing/sync-invoices", {
        method: "POST",
      });
      const data = (await res.json()) as {
        synced?: number;
        failed?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Sync fehlgeschlagen.");
        return;
      }
      toast.success(
        `${data.synced ?? 0} Rechnungen synchronisiert` +
          (data.failed ? ` · ${data.failed} Fehler` : ""),
      );
      await load();
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    let list = [...rows];
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.restaurant_name,
          r.restaurant_slug,
          r.stripe_invoice_id,
          r.stripe_customer_id,
          r.status,
          r.billing_reason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [rows, search, statusFilter]);

  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Stripe-Rechnungen für Gwada-Abos (Webhook + manueller Sync).
        </p>
        <Button
          type="button"
          size="lg"
          className={cn("shrink-0", brandActionButtonRoundedClassName)}
          disabled={syncing}
          onClick={() => void syncFromStripe()}
        >
          <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
          {syncing ? "Synchronisiere…" : "Von Stripe laden"}
        </Button>
      </div>

      <SuperadminSearchToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Restaurant, Invoice-ID…"
        filterLabel="Status"
        filterValue={statusFilter}
        filterOptions={[
          { value: "all", label: "Alle" },
          { value: "paid", label: "Bezahlt" },
          { value: "open", label: "Offen" },
          { value: "payment_failed", label: "Fehlgeschlagen" },
          { value: "void", label: "Storniert" },
        ]}
        onFilterChange={setStatusFilter}
      />

      <SuperadminPaginatedDataTable
        loading={loading}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage="Keine Rechnungen — Sync von Stripe oder warte auf Webhooks."
        itemLabel="Rechnungen"
        resetPageKey={`${search}\0${statusFilter}`}
        columns={[
          {
            id: "restaurant",
            header: "Restaurant",
            className: superadminCellNowrapClass,
            sortValue: (r) => r.restaurant_name ?? "",
            cell: (r) =>
              r.restaurant_name ? (
                <div>
                  <span className={`font-medium ${superadminCellNowrapClass}`}>
                    {r.restaurant_name}
                  </span>
                  {r.restaurant_slug ? (
                    <div className="font-mono text-xs text-muted-foreground">
                      {r.restaurant_slug}
                    </div>
                  ) : null}
                </div>
              ) : (
                <span className="text-muted-foreground">Nicht zugeordnet</span>
              ),
          },
          {
            id: "number",
            header: "Nummer",
            className: superadminCellNowrapClass,
            sortValue: (r) => r.number ?? r.stripe_invoice_id,
            cell: (r) => (
              <span className={`font-medium tabular-nums ${superadminCellNowrapClass}`}>
                {r.number ?? r.stripe_invoice_id}
              </span>
            ),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (r) => r.status,
            cell: (r) => (
              <Badge variant="outline" className={invoiceStatusClass(r.status)}>
                {billingStatusLabel(r.status)}
              </Badge>
            ),
          },
          {
            id: "amount",
            header: "Betrag",
            className: "text-right tabular-nums",
            sortValue: (r) => r.amount_paid || r.amount_due,
            cell: (r) =>
              formatEurFromCents(
                r.status === "paid" ? r.amount_paid : r.amount_due,
                r.currency,
              ),
          },
          {
            id: "reason",
            header: "Grund",
            sortValue: (r) => r.billing_reason ?? "",
            cell: (r) => r.billing_reason?.replaceAll("_", " ") || "—",
          },
          {
            id: "paid",
            header: "Bezahlt am",
            className: superadminDateCellClass,
            sortValue: (r) => r.paid_at ?? "",
            cell: (r) => (
              <span className={superadminDateCellClass}>
                {formatDt(r.paid_at)}
              </span>
            ),
          },
          {
            id: "created",
            header: "Erstellt",
            className: superadminDateCellClass,
            sortValue: (r) => r.stripe_created_at,
            cell: (r) => (
              <span className={superadminDateCellClass}>
                {formatDt(r.stripe_created_at)}
              </span>
            ),
          },
          {
            id: "link",
            header: "",
            sortValue: () => 0,
            cell: (r) =>
              r.hosted_invoice_url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Stripe-Rechnung"
                  render={
                    <a
                      href={r.hosted_invoice_url}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <ExternalLink className="size-3.5" />
                </Button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
