"use client";

import { Plug } from "lucide-react";
import { DashboardIntegrationLogo } from "@/components/dashboard/dashboard-integration-logo";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardIntegrationsSummary } from "@/lib/hooks/use-dashboard-integrations-summary";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { cn } from "@/lib/utils";

export function DashboardIntegrationsTile() {
  const { summary, loading, error, ready } = useDashboardIntegrationsSummary();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));

  const total = summary?.totalCount ?? 0;
  const connected = summary?.connectedCount ?? 0;
  const open = total - connected;

  return (
    <DashboardWidgetShell
      title="Integrationen"
      icon={
        <Plug
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href={APP_ROUTES.settings.integrations}
      linkLabel="Zu Integrationen"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">
          Derzeit sind keine Integrationen für euer Restaurant freigeschaltet.
        </p>
      ) : (
        <div className="space-y-3">
          <DashboardCompactInlineMetrics>
            <DashboardCompactMetricPill
              label="Verbunden"
              value={`${connected} / ${total}`}
              href={APP_ROUTES.settings.integrations}
              stripeVariant="active"
            />
            <DashboardCompactMetricPill
              label="Noch offen"
              value={String(open)}
              href={APP_ROUTES.settings.integrations}
              highlight={open > 0}
              stripeVariant="attention"
            />
          </DashboardCompactInlineMetrics>

          <ul
            className="flex list-none flex-wrap gap-2 p-0"
            aria-label="Integrationen"
          >
            {summary?.items.map((item) => (
              <li
                key={item.id}
                className="flex min-w-[3.25rem] flex-col items-center gap-1"
              >
                <DashboardIntegrationLogo
                  id={item.id}
                  connected={item.connected}
                />
                <span
                  className={cn(
                    "max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight",
                    item.connected
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
                <span className="sr-only">
                  {item.connected ? "verbunden" : "nicht verbunden"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardWidgetShell>
  );
}
