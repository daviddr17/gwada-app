"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SuperadminDataTable } from "@/components/superadmin/superadmin-data-table";
import { SuperadminSearchToolbar } from "@/components/superadmin/superadmin-search-toolbar";
import {
  fetchSuperadminWaitlist,
  type SuperadminWaitlistRow,
} from "@/lib/supabase/platform-superadmin-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  superadminCellNowrapClass,
  superadminDateCellClass,
} from "@/components/superadmin/superadmin-table-cells";

function formatName(row: SuperadminWaitlistRow): string {
  return [row.given_name, row.family_name].filter(Boolean).join(" ");
}

function formatDt(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function SuperadminWartelistePage() {
  const [rows, setRows] = useState<SuperadminWaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchSuperadminWaitlist(sb);
    if (error) toast.error(error);
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.given_name, r.family_name, r.email, r.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Warteliste</h2>
        <p className="text-sm text-muted-foreground">
          Anmeldungen über die öffentliche Warteliste (vor dem Live-Start).
        </p>
      </div>

      <SuperadminSearchToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Name, E-Mail oder Notiz …"
      />

      <SuperadminDataTable
        loading={loading}
        emptyMessage="Noch keine Einträge auf der Warteliste."
        columns={[
          {
            id: "created_at",
            header: "Eingetragen",
            className: superadminDateCellClass,
            sortValue: (r) => r.created_at,
            cell: (r) => (
              <span className={superadminCellNowrapClass}>{formatDt(r.created_at)}</span>
            ),
          },
          {
            id: "name",
            header: "Name",
            sortValue: (r) => formatName(r),
            cell: (r) => formatName(r),
          },
          {
            id: "email",
            header: "E-Mail",
            sortValue: (r) => r.email,
            cell: (r) => (
              <a
                href={`mailto:${encodeURIComponent(r.email)}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {r.email}
              </a>
            ),
          },
          {
            id: "note",
            header: "Notiz",
            sortValue: (r) => r.note ?? "",
            cell: (r) =>
              r.note?.trim() ? (
                <span className="line-clamp-2 max-w-md text-muted-foreground">{r.note}</span>
              ) : (
                "—"
              ),
          },
        ]}
        rows={filtered}
        rowKey={(r) => r.id}
        defaultSort={{ columnId: "created_at", direction: "desc" }}
      />
    </div>
  );
}
