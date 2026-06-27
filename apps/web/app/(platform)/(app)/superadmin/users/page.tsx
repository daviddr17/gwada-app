"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SuperadminPaginatedDataTable } from "@/components/superadmin/superadmin-paginated-data-table";
import { SuperadminSearchToolbar } from "@/components/superadmin/superadmin-search-toolbar";
import {
  fetchSuperadminUsers,
  type SuperadminUserRow,
} from "@/lib/supabase/platform-superadmin-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatLocaleLabel } from "@/lib/constants/locale-labels";
import {
  superadminCellNowrapClass,
  superadminDateCellClass,
} from "@/components/superadmin/superadmin-table-cells";
import { Badge } from "@/components/ui/badge";

function formatUserName(row: SuperadminUserRow): string {
  const gn = row.given_name?.trim() ?? "";
  const fn = row.family_name?.trim() ?? "";
  if (gn || fn) return [gn, fn].filter(Boolean).join(" ");
  return row.display_name?.trim() || "—";
}

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function SuperadminUsersPage() {
  const [rows, setRows] = useState<SuperadminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchSuperadminUsers(sb);
    if (error) toast.error(error);
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const localeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const l = r.locale?.trim();
      if (l) set.add(l);
    }
    return [
      { value: "all", label: "Alle Sprachen" },
      ...[...set]
        .sort((a, b) => formatLocaleLabel(a).localeCompare(formatLocaleLabel(b), "de"))
        .map((l) => ({ value: l, label: formatLocaleLabel(l) })),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (localeFilter !== "all") {
      list = list.filter((r) => r.locale === localeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.email,
          r.given_name,
          r.family_name,
          r.display_name,
          r.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [rows, search, localeFilter]);

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">User</h2>
        <p className="text-sm text-muted-foreground">
          Alle registrierten Konten mit Profil- und Anmeldeinformationen.
        </p>
      </div>

      <SuperadminSearchToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="E-Mail, Name oder Telefon…"
        filterLabel="Sprache"
        filterValue={localeFilter}
        filterOptions={localeOptions}
        onFilterChange={setLocaleFilter}
      />

      <SuperadminPaginatedDataTable
        loading={loading}
        rows={filtered}
        rowKey={(r) => r.profile_id}
        emptyMessage="Keine User gefunden."
        itemLabel="User"
        resetPageKey={`${search}\0${localeFilter}`}
        columns={[
          {
            id: "email",
            header: "E-Mail",
            sortValue: (r) => r.email ?? "",
            cell: (r) => (
              <span className="font-medium">{r.email ?? "—"}</span>
            ),
          },
          {
            id: "name",
            header: "Name",
            className: superadminCellNowrapClass,
            sortValue: (r) => formatUserName(r),
            cell: (r) => (
              <span className={superadminCellNowrapClass}>
                {formatUserName(r)}
              </span>
            ),
          },
          {
            id: "online",
            header: "Online",
            className: superadminDateCellClass,
            sortValue: (r) =>
              `${r.is_online ? "1" : "0"}_${r.last_seen_at ?? ""}`,
            cell: (r) =>
              r.is_online ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 font-normal text-emerald-800 dark:text-emerald-200"
                >
                  Online
                </Badge>
              ) : (
                <span className={superadminDateCellClass}>
                  {r.last_seen_at ? formatDt(r.last_seen_at) : "—"}
                </span>
              ),
          },
          {
            id: "phone",
            header: "Telefon",
            sortValue: (r) => r.phone?.trim() ?? "",
            cell: (r) => r.phone?.trim() || "—",
          },
          {
            id: "locale",
            header: "Sprache",
            sortValue: (r) => formatLocaleLabel(r.locale ?? ""),
            cell: (r) =>
              r.locale ? (
                <Badge variant="outline" className="font-normal">
                  {formatLocaleLabel(r.locale)}
                </Badge>
              ) : (
                "—"
              ),
          },
          {
            id: "restaurants",
            header: "Restaurants",
            className: "text-right tabular-nums",
            sortValue: (r) => r.restaurant_count,
            cell: (r) => r.restaurant_count,
          },
          {
            id: "created",
            header: "Registriert",
            className: superadminDateCellClass,
            sortValue: (r) => r.created_at ?? "",
            cell: (r) => (
              <span className={superadminDateCellClass}>
                {formatDt(r.created_at)}
              </span>
            ),
          },
          {
            id: "last_sign_in",
            header: "Letzter Login",
            className: superadminDateCellClass,
            sortValue: (r) => r.last_sign_in_at ?? "",
            cell: (r) => (
              <span className={superadminDateCellClass}>
                {formatDt(r.last_sign_in_at)}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
