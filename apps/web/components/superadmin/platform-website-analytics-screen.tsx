"use client";

import { useMemo, useState } from "react";
import { PlatformAnalyticsSkeleton } from "@/components/superadmin/platform-analytics-skeleton";
import { WebsiteAnalyticsFilterDrawer } from "@/components/superadmin/platform-analytics-filter-drawer";
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
  ANALYTICS_BROWSER_OPTIONS,
  ANALYTICS_DEVICE_OPTIONS,
  ANALYTICS_SURFACE_OPTIONS,
  analyticsBrowserLabel,
  analyticsDeviceLabel,
  analyticsRangeLabel,
  analyticsReferrerLabel,
  analyticsSurfaceLabel,
  formatAnalyticsCount,
  formatAnalyticsDateTime,
  formatPagesPerVisit,
} from "@/lib/analytics/analytics-labels";
import {
  ANALYTICS_RANGE_DEFAULT,
  type AnalyticsRange,
} from "@/lib/analytics/analytics-range";
import type { WebsiteAnalytics } from "@/lib/analytics/platform-analytics-types";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { superadminCellNowrapClass } from "@/components/superadmin/superadmin-table-cells";

const ALL = "all";

function countFilters(input: {
  range: AnalyticsRange;
  device: string;
  browser: string;
  country: string;
  surface: string;
}): number {
  let count = 0;
  if (input.range !== ANALYTICS_RANGE_DEFAULT) count += 1;
  if (input.device !== ALL) count += 1;
  if (input.browser !== ALL) count += 1;
  if (input.country !== ALL) count += 1;
  if (input.surface !== ALL) count += 1;
  return count;
}

export function PlatformWebsiteAnalyticsScreen() {
  const [range, setRange] = useState<AnalyticsRange>(ANALYTICS_RANGE_DEFAULT);
  const [device, setDevice] = useState(ALL);
  const [browser, setBrowser] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [surface, setSurface] = useState(ALL);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams({ range, device, browser, country, surface });
    return `/api/superadmin/analytics/website?${params.toString()}`;
  }, [range, device, browser, country, surface]);

  const { data, error, loading, busy } = usePlatformAnalytics<WebsiteAnalytics>(url);
  const showSkeleton = useDeferredSkeleton(loading);
  const query = search.trim().toLowerCase();

  const pages = useMemo(() => {
    if (!data) return [];
    return data.pages.filter((row) => {
      if (!query) return true;
      return (
        row.path.toLowerCase().includes(query) ||
        analyticsSurfaceLabel(row.surface).toLowerCase().includes(query)
      );
    });
  }, [data, query]);

  const referrers = useMemo(() => {
    if (!data) return [];
    return data.referrers.filter((row) => {
      if (!query) return true;
      return analyticsReferrerLabel(row.host).toLowerCase().includes(query);
    });
  }, [data, query]);

  const countries = useMemo(() => {
    if (!data) return [];
    return data.countries.filter((row) => {
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.code.toLowerCase().includes(query)
      );
    });
  }, [data, query]);

  const countryOptions = useMemo(() => {
    const seen = new Set<string>([ALL]);
    const options = [{ value: ALL, label: "Alle Länder" }];
    for (const row of data?.facets.countries ?? []) {
      if (!row.code || seen.has(row.code)) continue;
      seen.add(row.code);
      options.push({ value: row.code, label: row.name });
    }
    return options;
  }, [data]);

  const surfaceOptions = useMemo(() => {
    const known = new Set(ANALYTICS_SURFACE_OPTIONS.map((option) => option.value));
    const extra = (data?.facets.surfaces ?? [])
      .filter((value) => !known.has(value))
      .map((value) => ({ value, label: analyticsSurfaceLabel(value) }));
    return [...ANALYTICS_SURFACE_OPTIONS, ...extra];
  }, [data]);

  const resetFilters = () => {
    setRange(ANALYTICS_RANGE_DEFAULT);
    setDevice(ALL);
    setBrowser(ALL);
    setCountry(ALL);
    setSurface(ALL);
  };

  const bucketLabel = data?.bucket === "hour" ? "pro Stunde" : "pro Tag";
  const periodLabel = data
    ? `${analyticsRangeLabel(range)} · ${formatAnalyticsDateTime(data.from)} – ${formatAnalyticsDateTime(data.to)} Uhr, Europe/Berlin`
    : analyticsRangeLabel(range);

  return (
    <div className="space-y-6 pt-2" aria-busy={busy}>
      <p className="text-sm text-muted-foreground">
        Seitenaufrufe der öffentlichen Website: Marketing, Docs, Anmeldung,
        Embeds und öffentliche Restaurantseiten. Gerät und Browser stammen aus
        dem User-Agent, das Land aus dem Edge-Header. IP-Adressen werden nicht
        gespeichert.
      </p>

      <PlatformAnalyticsToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Seite, Verweis oder Land"
        periodLabel={periodLabel}
        activeFilters={countFilters({ range, device, browser, country, surface })}
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
              { label: "Seitenaufrufe", value: formatAnalyticsCount(data.pageViews) },
              {
                label: "Besuche",
                value: formatAnalyticsCount(data.visits),
                hint: "Eigene Sitzung, 30 Minuten",
              },
              {
                label: "Besucher",
                value: formatAnalyticsCount(data.visitors),
                hint: "Zufällige Cookie-ID",
              },
              {
                label: "Seiten pro Besuch",
                value: formatPagesPerVisit(data.pageViews, data.visits),
              },
              {
                label: "Länder",
                value: formatAnalyticsCount(data.countries.length),
                hint: data.countries[0]?.name,
              },
            ]}
          />

          {data.pageViews === 0 ? (
            <p className="text-sm text-muted-foreground">
              Im gewählten Zeitraum gibt es noch keine Aufrufe. Ein Besuch der
              Startseite oder der Docs schreibt den ersten Eintrag — Superadmin
              selbst wird nicht mitgezählt.
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <SuperadminAreaChartCard
              title="Seitenaufrufe"
              description={`Aufgerufene Seiten ${bucketLabel}.`}
              data={chartSeries(data.series)}
              dataKey="pageViews"
              yLabel="Aufrufe"
            />
            <SuperadminAreaChartCard
              title="Besuche"
              description={`Sitzungen ${bucketLabel}.`}
              data={chartSeries(data.series)}
              dataKey="visits"
              yLabel="Besuche"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SuperadminBarChartCard
              title="Geräte"
              description="Aufrufe nach Gerätetyp."
              data={barOrEmpty(
                data.devices.map((row) => ({
                  name: analyticsDeviceLabel(row.device),
                  count: row.pageViews,
                })),
              )}
              yLabel="Aufrufe"
            />
            <SuperadminBarChartCard
              title="Browser"
              description="Aufrufe nach Browser."
              data={barOrEmpty(
                data.browsers.map((row) => ({
                  name: analyticsBrowserLabel(row.browser),
                  count: row.pageViews,
                })),
              )}
              yLabel="Aufrufe"
            />
          </div>

          <SuperadminBarChartCard
            title="Verweise"
            description="Die acht häufigsten Herkunfts-Hosts, gezählt je Besuch."
            horizontal
            data={barOrEmpty(
              referrers.slice(0, 8).map((row) => ({
                name: analyticsReferrerLabel(row.host),
                count: row.visits,
              })),
            )}
            yLabel="Besuche"
          />

          <AnalyticsSection
            title="Seiten"
            description="Die meistaufgerufenen Pfade, ohne Query-Parameter."
          >
            <SuperadminPaginatedDataTable
              rows={pages}
              rowKey={(row) => row.path}
              itemLabel="Seiten"
              emptyMessage="Keine Seiten im Zeitraum."
              resetPageKey={`${query}:${url}`}
              columns={[
                {
                  id: "path",
                  header: "Pfad",
                  sortValue: (row) => row.path,
                  cell: (row) => (
                    <span className="font-mono text-xs">{row.path}</span>
                  ),
                },
                {
                  id: "surface",
                  header: "Bereich",
                  className: superadminCellNowrapClass,
                  sortValue: (row) => analyticsSurfaceLabel(row.surface),
                  cell: (row) => analyticsSurfaceLabel(row.surface),
                },
                {
                  id: "pageViews",
                  header: "Aufrufe",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.pageViews,
                  cell: (row) => formatAnalyticsCount(row.pageViews),
                },
                {
                  id: "visits",
                  header: "Besuche",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.visits,
                  cell: (row) => formatAnalyticsCount(row.visits),
                },
                {
                  id: "visitors",
                  header: "Besucher",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.visitors,
                  cell: (row) => formatAnalyticsCount(row.visitors),
                },
              ]}
            />
          </AnalyticsSection>

          <AnalyticsSection
            title="Verweise"
            description="Externer Host der Sitzung. Direkt bedeutet kein fremder Referrer."
          >
            <SuperadminPaginatedDataTable
              rows={referrers}
              rowKey={(row) => row.host || "direct"}
              itemLabel="Verweise"
              emptyMessage="Keine Verweise im Zeitraum."
              resetPageKey={`${query}:${url}`}
              columns={[
                {
                  id: "host",
                  header: "Host",
                  sortValue: (row) => analyticsReferrerLabel(row.host),
                  cell: (row) => analyticsReferrerLabel(row.host),
                },
                {
                  id: "visits",
                  header: "Besuche",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.visits,
                  cell: (row) => formatAnalyticsCount(row.visits),
                },
                {
                  id: "pageViews",
                  header: "Aufrufe",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.pageViews,
                  cell: (row) => formatAnalyticsCount(row.pageViews),
                },
              ]}
            />
          </AnalyticsSection>

          <AnalyticsSection
            title="Länder"
            description="Land aus dem Edge-Header. Ohne Header bleibt der Aufruf unbekannt."
          >
            <SuperadminPaginatedDataTable
              rows={countries}
              rowKey={(row) => row.code || row.name}
              itemLabel="Länder"
              emptyMessage="Keine Länder im Zeitraum."
              resetPageKey={`${query}:${url}`}
              columns={[
                {
                  id: "name",
                  header: "Land",
                  sortValue: (row) => row.name,
                  cell: (row) => row.name,
                },
                {
                  id: "code",
                  header: "Code",
                  className: superadminCellNowrapClass,
                  sortValue: (row) => row.code,
                  cell: (row) => row.code || "—",
                },
                {
                  id: "pageViews",
                  header: "Aufrufe",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.pageViews,
                  cell: (row) => formatAnalyticsCount(row.pageViews),
                },
                {
                  id: "visitors",
                  header: "Besucher",
                  className: "text-right tabular-nums",
                  sortValue: (row) => row.visitors,
                  cell: (row) => formatAnalyticsCount(row.visitors),
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

      <WebsiteAnalyticsFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        range={range}
        onRangeChange={setRange}
        device={device}
        onDeviceChange={setDevice}
        deviceOptions={ANALYTICS_DEVICE_OPTIONS}
        browser={browser}
        onBrowserChange={setBrowser}
        browserOptions={ANALYTICS_BROWSER_OPTIONS}
        country={country}
        onCountryChange={setCountry}
        countryOptions={countryOptions}
        surface={surface}
        onSurfaceChange={setSurface}
        surfaceOptions={surfaceOptions}
        onReset={resetFilters}
      />
    </div>
  );
}

function chartSeries(
  series: WebsiteAnalytics["series"],
): { label: string; pageViews: number; visits: number }[] {
  if (series.length === 0) {
    return [{ label: "—", pageViews: 0, visits: 0 }];
  }
  return series.map((point) => ({
    label: point.label,
    pageViews: point.pageViews,
    visits: point.visits,
  }));
}

function barOrEmpty(rows: { name: string; count: number }[]) {
  return rows.length > 0 ? rows : [{ name: "Keine Daten", count: 0 }];
}
