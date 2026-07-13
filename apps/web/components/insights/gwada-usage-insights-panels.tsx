"use client";

import { Code2, Eye, LayoutTemplate, MousePointerClick } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import type { RestaurantUsageInsights } from "@/lib/insights/restaurant-usage-constants";

function BreakdownList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { key: string; label: string; count: number }[];
}) {
  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="truncate text-foreground">{row.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {row.count.toLocaleString("de-DE")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** First-party Gwada Usage (Embed / API / Profil) — keine Social-Impressions. */
export function GwadaUsageInsightsPanels({
  usage,
}: {
  usage: RestaurantUsageInsights;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Nutzung in Gwada (Embeds, Restaurant-API, öffentliches Profil). Tagesaggregate
        ohne IP/User-Agent; öffentliche Widgets max. 1× pro Session und Tag. Client-Beacons
        können durch Adblocker unterzählt werden — API-Zähler sind serverseitig.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={LayoutTemplate}
          label="Embed-Aufrufe"
          value={String(usage.embedViews)}
          hint="Widget-Ladevorgänge (Session-Dedup)"
        />
        <KpiCard
          icon={Code2}
          label="API-Anfragen"
          value={String(usage.apiRequests)}
          hint="Erfolgreiche Restaurant-API-Calls"
        />
        <KpiCard
          icon={Eye}
          label="Profil-Aufrufe"
          value={String(usage.profileViews)}
          hint="Öffentliches Restaurant-Profil"
        />
        <KpiCard
          icon={MousePointerClick}
          label="Modul-Öffnungen"
          value={String(usage.profileModuleOpens)}
          hint="Apps im öffentlichen Profil"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownList
          title="Embeds nach Widget"
          empty="Noch keine Embed-Aufrufe im Zeitraum."
          rows={usage.embedByWidget}
        />
        <BreakdownList
          title="API nach Modul"
          empty="Noch keine API-Anfragen im Zeitraum."
          rows={usage.apiByModule}
        />
        <BreakdownList
          title="Profil nach Modul"
          empty="Noch keine Modul-Öffnungen im Zeitraum."
          rows={usage.profileByModule}
        />
      </div>
    </div>
  );
}
