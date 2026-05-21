"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SuperadminDataTable } from "@/components/superadmin/superadmin-data-table";
import { SuperadminSearchToolbar } from "@/components/superadmin/superadmin-search-toolbar";
import {
  fetchSuperadminUsers,
  type SuperadminUserRow,
} from "@/lib/supabase/platform-superadmin-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
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
      ...[...set].sort().map((l) => ({ value: l, label: l })),
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

      <SuperadminDataTable
        loading={loading}
        rows={filtered}
        rowKey={(r) => r.profile_id}
        emptyMessage="Keine User gefunden."
        columns={[
          {
            id: "email",
            header: "E-Mail",
            cell: (r) => (
              <span className="font-medium">{r.email ?? "—"}</span>
            ),
          },
          {
            id: "name",
            header: "Name",
            cell: (r) => formatUserName(r),
          },
          {
            id: "phone",
            header: "Telefon",
            cell: (r) => r.phone?.trim() || "—",
          },
          {
            id: "locale",
            header: "Locale",
            cell: (r) =>
              r.locale ? (
                <Badge variant="outline" className="font-normal">
                  {r.locale}
                </Badge>
              ) : (
                "—"
              ),
          },
          {
            id: "restaurants",
            header: "Restaurants",
            className: "text-right tabular-nums",
            cell: (r) => r.restaurant_count,
          },
          {
            id: "created",
            header: "Registriert",
            cell: (r) => formatDt(r.created_at),
          },
          {
            id: "last_sign_in",
            header: "Letzte Anmeldung",
            cell: (r) => formatDt(r.last_sign_in_at),
          },
        ]}
      />
    </div>
  );
}
