"use client";

import { useMemo, useState } from "react";
import { PlatformAnalyticsSkeleton } from "@/components/superadmin/platform-analytics-skeleton";
import { ProductUsageFilterDrawer } from "@/components/superadmin/platform-analytics-filter-drawer";
import {
  AnalyticsSection,
  PlatformAnalyticsMissing,
  PlatformAnalyticsToolbar,
  usePlatformAnalytics,
} from "@/components/superadmin/platform-analytics-ui";
import { SuperadminPaginatedDataTable } from "@/components/superadmin/superadmin-paginated-data-table";
import { SuperadminStatsKpiGrid } from "@/components/superadmin/superadmin-stats-kpi-grid";
import {
  SuperadminAreaChartCard,
  SuperadminBarChartCard,
} from "@/components/superadmin/superadmin-stats-charts";
import {
  analyticsLoginMethodLabel,
  analyticsModuleLabel,
  analyticsModuleOptions,
  analyticsRangeLabel,
  formatAnalyticsCount,
  formatAnalyticsDateTime,
} from "@/lib/analytics/analytics-labels";
import {
  ANALYTICS_RANGE_DEFAULT,
  type AnalyticsRange,
} from "@/lib/analytics/analytics-range";
import type { ProductUsageAnalytics } from "@/lib/analytics/platform-analytics-types";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { superadminDateCellClass } from "@/components/superadmin/superadmin-table-cells";

const ALL = "all";

export function PlatformUsageAnalyticsScreen() {
  const [range, setRange] = useState<AnalyticsRange>(ANALYTICS_RANGE_DEFAULT);
  const [moduleId, setModuleId] = useState(ALL);
  const [restaurantId, setRestaurantId] = useState(ALL);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      range,
      module: moduleId,
      restaurant: restaurantId,
    });
    return `/api/superadmin/analytics/usage?${params.toString()}`;
  }, [range, moduleId, restaurantId]);

  const { data, error, loading, busy } = usePlatformAnalytics<ProductUsageAnalytics>(url);
  const showSkeleton = useDeferredSkeleton(loading);
  const query = search.trim().toLowerCase();

  const modules = useMemo(() => {
    if (!data) return [];
    return data.modules.filter((row) => {
      if (!query) return true;
      return analyticsModuleLabel(row.moduleId).toLowerCase().includes(query);
    });
  }, [data, query]);

  const users = useMemo(() => {
    if (!data) return [];
    return data.users.filter((row) => {
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        (row.email ?? "").toLowerCase().includes(query) ||
        analyticsModuleLabel(row.topModule).toLowerCase().includes(query)
      );
    });
  }, [data, query]);

  const restaurants = useMemo(() => {
    if (!data) return [];
    return data.restaurants.filter((row) => {
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        analyticsModuleLabel(row.topModule).toLowerCase().includes(query)
      );
    });
  }, [data, query]);

  const moduleOptions = useMemo(
    () => analyticsModuleOptions(data?.facets.modules ?? []),
    [data],
  );
  const restaurantOptions = useMemo(() => {
    const options = [{ value: ALL, label: "Alle Restaurants" }];
    for (const row of data?.facets.restaurants ?? []) {
      if (!row.id) continue;
      options.push({ value: row.id, label: row.name });
    }
    return options;
  }, [data]);

  const resetFilters = () => {
    setRange(ANALYTICS_RANGE_DEFAULT);
    setModuleId(ALL);
    setRestaurantId(ALL);
  };

  const activeFilters =
    (range === ANALYTICS_RANGE_DEFAULT ? 0 : 1) +
    (moduleId === ALL ? 0 : 1) +
    (restaurantId === ALL ? 0 : 1);

  const bucketLabel = data?.bucket === "hour" ? "pro Stunde" : "pro Tag";
  const periodLabel = data
    ? `${analyticsRangeLabel(range)} · ${formatAnalyticsDateTime(data.from)} – ${formatAnalyticsDateTime(data.to)} Uhr, Europe/Berlin`
    : analyticsRangeLabel(range);
  const quiet =
    data != null && data.logins === 0 && data.moduleViews === 0 && data.activeUsers === 0;

  return (
    <div className="space-y-6 pt-2" aria-busy={busy}>
      <p className="text-sm text-muted-foreground">
        Angemeldete Nutzung: wer sich anmeldet, welches Restaurant aktiv ist
        und welche Module geöffnet werden. Auswertbar gesamt, je Nutzer und je
        Restaurant.
      </p>

      <PlatformAnalyticsToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Nutzer, Restaurant oder Modul"
        periodLabel={periodLabel}
        activeFilters={activeFilters}
        onOpenFilters={() => setFilterOpen(true)}
      />

      {showSkeleton ? (
        <PlatformAnalyticsSkeleton />
      ) : loading ? (
        <div className="min-h-[24rem]" aria-busy="true" />
      ) : error === "migration_missing" ? (
        <PlatformAnalyticsMissing />
      ) : data ? (
        <>
          <SuperadminStatsKpiGrid
            items={[
              {
                label: "Aktive Nutzer",
                value: formatAnalyticsCount(data.activeUsers),
                hint: "Anmeldung oder Modul im Zeitraum",
              },
              {
                label: "Aktive Restaurants",
                value: formatAnalyticsCount(data.activeRestaurants),
                hint: "Modulaufruf oder Anmeldung eines Mitarbeiters",
              },
              {
                label: "Anmeldungen",
                value: formatAnalyticsCount(data.logins),
                hint: "Passwort, Passkey, OAuth, Code",
              },
              {
                label: "Modulaufrufe",
                value: formatAnalyticsCount(data.moduleViews),
              },
              {
                label: "Module",
                value: formatAnalyticsCount(data.modules.length),
                hint: "Verschiedene Module im Zeitraum",
              },
            ]}
          />

          {quiet ? (
            <p className="text-sm text-muted-foreground">
              Im gewählten Zeitraum gibt es noch keine Anmeldung und keinen
              Modulaufruf. Nach einem Login und einem Wechsel ins Dashboard
              erscheinen die Zahlen hier.
            </p>
          ) : null}

          {moduleId !== ALL ? (
            <p className="text-sm text-muted-foreground">
              Der Modul-Filter grenzt Modulaufrufe, Nutzer und Restaurants ein.
              Die Anmeldungen bleiben im Zeitraum
              {restaurantId !== ALL ? " und am gewählten Restaurant" : ""}.
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <SuperadminAreaChartCard
              title="Anmeldungen"
              description={`Neue Sitzungen ${bucketLabel}.`}
              data={seriesOrEmpty(data.loginSeries)}
              dataKey="count"
              yLabel="Anmeldungen"
            />
            <SuperadminAreaChartCard
              title="Modulaufrufe"
              description={`Geöffnete Module ${bucketLabel}.`}
              data={seriesOrEmpty(data.moduleSeries)}
              dataKey="count"
              yLabel="Aufrufe"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <SuperadminBarChartCard
              className="lg:col-span-3"
              title="Module"
              description="Aufrufe je Modul."
              horizontal
              data={barOrEmpty(
                modules.slice(0, 12).map((row) => ({
                  name: analyticsModuleLabel(row.moduleId),
                  count: row.views,
                })),
              )}
              yLabel="Aufrufe"
            />
            <SuperadminBarChartCard
              className="lg:col-span-2"
              title="Anmeldeart"
              description="Wie die Sitzung entstanden ist."
              data={barOrEmpty(
                data.loginMethods.map((row) => ({
                  name: analyticsLoginMethodLabel(row.method),
                  count: row.count,
                })),
              )}
              yLabel="Anmeldungen"
            />
          </div>

          <AnalyticsSection
            title="Module"
            description="Nutzer und Restaurants, die das Modul im Zeitraum geöffnet haben."
          >
            <SuperadminPaginatedDataTable
              rows={modules}
              rowKey={(row) => row.moduleId}
              itemLabel="Module"
              emptyMessage="Keine Modulaufrufe im Zeitraum."
              resetPageKey={`${query}:${url}`}
              columns={[
                {
                  id: "module",
                  header: "Modul",
                  sortValue: (row) => analyticsModuleLabel(row.moduleId),
                  cell: (row) => analyticsModuleLabel(row.moduleId),
                },
                {
                  id: "views",
                  header: "Aufrufe",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.views,
                  cell: (row) => formatAnalyticsCount(row.views),
                },
                {
                  id: "users",
                  header: "Nutzer",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.users,
                  cell: (row) => formatAnalyticsCount(row.users),
                },
                {
                  id: "restaurants",
                  header: "Restaurants",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.restaurants,
                  cell: (row) => formatAnalyticsCount(row.restaurants),
                },
              ]}
            />
          </AnalyticsSection>

          <AnalyticsSection
            title="Nutzer"
            description="Je Konto: Anmeldungen, Modulaufrufe und das meistgenutzte Modul."
          >
            <SuperadminPaginatedDataTable
              rows={users}
              rowKey={(row) => row.profileId}
              itemLabel="Nutzer"
              emptyMessage="Keine aktiven Nutzer im Zeitraum."
              resetPageKey={`${query}:${url}`}
              columns={[
                {
                  id: "name",
                  header: "Name",
                  sortValue: (row) => row.name,
                  cell: (row) => row.name,
                },
                {
                  id: "email",
                  header: "E-Mail",
                  sortValue: (row) => row.email ?? "",
                  cell: (row) => row.email ?? "—",
                },
                {
                  id: "logins",
                  header: "Anmeldungen",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.logins,
                  cell: (row) => formatAnalyticsCount(row.logins),
                },
                {
                  id: "moduleViews",
                  header: "Modulaufrufe",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.moduleViews,
                  cell: (row) => formatAnalyticsCount(row.moduleViews),
                },
                {
                  id: "restaurants",
                  header: "Restaurants",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.restaurantCount,
                  cell: (row) => formatAnalyticsCount(row.restaurantCount),
                },
                {
                  id: "top",
                  header: "Meistgenutzt",
                  sortValue: (row) => analyticsModuleLabel(row.topModule),
                  cell: (row) => analyticsModuleLabel(row.topModule),
                },
                {
                  id: "last",
                  header: "Zuletzt",
                  className: superadminDateCellClass,
                  sortValue: (row) => row.lastAt ?? "",
                  cell: (row) => formatAnalyticsDateTime(row.lastAt),
                },
              ]}
            />
          </AnalyticsSection>

          <AnalyticsSection
            title="Restaurants"
            description="Modulaufrufe in diesem Haus. Anmeldungen zählen aktive Mitarbeiter, auch wenn die Anmeldung selbst keinem Restaurant zugeordnet war."
          >
            <SuperadminPaginatedDataTable
              rows={restaurants}
              rowKey={(row) => row.restaurantId}
              itemLabel="Restaurants"
              emptyMessage="Keine aktiven Restaurants im Zeitraum."
              resetPageKey={`${query}:${url}`}
              columns={[
                {
                  id: "name",
                  header: "Restaurant",
                  sortValue: (row) => row.name,
                  cell: (row) => row.name,
                },
                {
                  id: "users",
                  header: "Nutzer",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.users,
                  cell: (row) => formatAnalyticsCount(row.users),
                },
                {
                  id: "moduleViews",
                  header: "Modulaufrufe",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.moduleViews,
                  cell: (row) => formatAnalyticsCount(row.moduleViews),
                },
                {
                  id: "logins",
                  header: "Anmeldungen",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.logins,
                  cell: (row) => formatAnalyticsCount(row.logins),
                },
                {
                  id: "top",
                  header: "Meistgenutzt",
                  sortValue: (row) => analyticsModuleLabel(row.topModule),
                  cell: (row) => analyticsModuleLabel(row.topModule),
                },
                {
                  id: "last",
                  header: "Zuletzt",
                  className: superadminDateCellClass,
                  sortValue: (row) => row.lastAt ?? "",
                  cell: (row) => formatAnalyticsDateTime(row.lastAt),
                },
              ]}
            />
          </AnalyticsSection>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Die Statistik konnte nicht geladen werden.
        </p>
      )}

      <ProductUsageFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        range={range}
        onRangeChange={setRange}
        moduleId={moduleId}
        onModuleChange={setModuleId}
        moduleOptions={moduleOptions}
        restaurantId={restaurantId}
        onRestaurantChange={setRestaurantId}
        restaurantOptions={restaurantOptions}
        onReset={resetFilters}
      />
    </div>
  );
}

function seriesOrEmpty(series: { label: string; count: number }[]) {
  return series.length > 0 ? series : [{ label: "—", count: 0 }];
}

function barOrEmpty(rows: { name: string; count: number }[]) {
  return rows.length > 0 ? rows : [{ name: "Keine Daten", count: 0 }];
}
