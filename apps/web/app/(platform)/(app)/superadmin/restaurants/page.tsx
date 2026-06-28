"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SuperadminPaginatedDataTable } from "@/components/superadmin/superadmin-paginated-data-table";
import { SuperadminSearchToolbar } from "@/components/superadmin/superadmin-search-toolbar";
import {
  fetchSuperadminRestaurants,
  type SuperadminRestaurantRow,
} from "@/lib/supabase/platform-superadmin-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  superadminCellNowrapClass,
  superadminDateCellClass,
} from "@/components/superadmin/superadmin-table-cells";
import { Badge } from "@/components/ui/badge";
import { formatRestaurantTimezoneLabel } from "@/lib/restaurant/restaurant-timezone";

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
      <p className="text-sm text-muted-foreground">
        Alle Restaurants in der Plattform mit Owner und Teamgröße.
      </p>

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

      <SuperadminPaginatedDataTable
        loading={loading}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage="Keine Restaurants gefunden."
        itemLabel="Restaurants"
        resetPageKey={`${search}\0${publishedFilter}`}
        columns={[
          {
            id: "name",
            header: "Name",
            className: superadminCellNowrapClass,
            sortValue: (r) => r.name,
            cell: (r) => (
              <span className={`font-medium ${superadminCellNowrapClass}`}>
                {r.name}
              </span>
            ),
          },
          {
            id: "slug",
            header: "Slug",
            className: superadminCellNowrapClass,
            sortValue: (r) => r.slug,
            cell: (r) => (
              <span className="font-mono text-xs text-muted-foreground">
                {r.slug}
              </span>
            ),
          },
          {
            id: "owner",
            header: "Owner",
            sortValue: (r) =>
              r.owner_display_name?.trim() || r.owner_email?.trim() || "",
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
            sortValue: (r) => r.email?.trim() || r.phone?.trim() || "",
            cell: (r) => r.email?.trim() || r.phone?.trim() || "—",
          },
          {
            id: "timezone",
            header: "Zeitzone",
            className: superadminCellNowrapClass,
            sortValue: (r) => r.timezone,
            cell: (r) => formatRestaurantTimezoneLabel(r.timezone),
          },
          {
            id: "team",
            header: "Team",
            className: "text-right tabular-nums",
            sortValue: (r) => r.employee_count,
            cell: (r) => r.employee_count,
          },
          {
            id: "status",
            header: "Status",
            sortValue: (r) => (r.is_published ? 1 : 0),
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
            header: "Angelegt am",
            className: superadminDateCellClass,
            sortValue: (r) => r.created_at ?? "",
            cell: (r) => (
              <span className={superadminDateCellClass}>
                {formatDt(r.created_at)}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
