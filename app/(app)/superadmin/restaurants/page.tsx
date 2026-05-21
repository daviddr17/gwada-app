"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SuperadminDataTable } from "@/components/superadmin/superadmin-data-table";
import { SuperadminSearchToolbar } from "@/components/superadmin/superadmin-search-toolbar";
import {
  fetchSuperadminRestaurants,
  type SuperadminRestaurantRow,
} from "@/lib/supabase/platform-superadmin-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";

function formatDt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function SuperadminRestaurantsPage() {
  const [rows, setRows] = useState<SuperadminRestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows: data, error } = await fetchSuperadminRestaurants(sb);
    if (error) toast.error(error);
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (publishedFilter === "published") {
      list = list.filter((r) => r.is_published);
    } else if (publishedFilter === "draft") {
      list = list.filter((r) => !r.is_published);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.name,
          r.slug,
          r.email,
          r.phone,
          r.owner_email,
          r.owner_display_name,
          r.timezone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [rows, search, publishedFilter]);

  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Restaurants</h2>
        <p className="text-sm text-muted-foreground">
          Alle Restaurants in der Plattform mit Owner und Teamgröße.
        </p>
      </div>

      <SuperadminSearchToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Name, Slug, E-Mail…"
        filterLabel="Status"
        filterValue={publishedFilter}
        filterOptions={[
          { value: "all", label: "Alle" },
          { value: "published", label: "Veröffentlicht" },
          { value: "draft", label: "Entwurf" },
        ]}
        onFilterChange={setPublishedFilter}
      />

      <SuperadminDataTable
        loading={loading}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage="Keine Restaurants gefunden."
        columns={[
          {
            id: "name",
            header: "Name",
            cell: (r) => (
              <div>
                <span className="font-medium">{r.name}</span>
                <div className="text-xs text-muted-foreground">{r.slug}</div>
              </div>
            ),
          },
          {
            id: "owner",
            header: "Owner",
            cell: (r) => (
              <div>
                <span>{r.owner_display_name?.trim() || "—"}</span>
                {r.owner_email ? (
                  <div className="text-xs text-muted-foreground">
                    {r.owner_email}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            id: "contact",
            header: "Kontakt",
            cell: (r) => r.email?.trim() || r.phone?.trim() || "—",
          },
          {
            id: "timezone",
            header: "Zeitzone",
            cell: (r) => r.timezone,
          },
          {
            id: "team",
            header: "Team",
            className: "text-right tabular-nums",
            cell: (r) => r.employee_count,
          },
          {
            id: "status",
            header: "Status",
            cell: (r) =>
              r.is_published ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                >
                  Live
                </Badge>
              ) : (
                <Badge variant="outline">Entwurf</Badge>
              ),
          },
          {
            id: "created",
            header: "Angelegt",
            cell: (r) => formatDt(r.created_at),
          },
        ]}
      />
    </div>
  );
}
