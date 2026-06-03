"use client";

import { Plug } from "lucide-react";
import { DashboardIntegrationLogo } from "@/components/dashboard/dashboard-integration-logo";
import {
  DashboardStatBlock,
  DashboardWidgetStatsGrid,
} from "@/components/dashboard/dashboard-stat-block";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardIntegrationsSummary } from "@/lib/hooks/use-dashboard-integrations-summary";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { cn } from "@/lib/utils";

export function DashboardIntegrationsTile() {
  const { summary, loading, error, ready } = useDashboardIntegrationsSummary();
  const showSkeleton = useDeferredSkeleton(!ready || loading);

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
      href="/settings/integrationen"
      linkLabel="Zu Integrationen"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Derzeit sind keine Integrationen für euer Restaurant freigeschaltet.
        </p>
      ) : (
        <div className="space-y-3">
          <DashboardWidgetStatsGrid columns={2}>
            <DashboardStatBlock
              size="compact"
              label="Verbunden"
              primary={String(connected)}
              secondary={`von ${total} Kanälen`}
            />
            <DashboardStatBlock
              size="compact"
              label="Noch offen"
              primary={String(open)}
              secondary="In den Einstellungen verbinden"
            />
          </DashboardWidgetStatsGrid>

          <ul
            className="flex list-none flex-wrap gap-4 p-0"
            aria-label="Integrationen"
          >
            {summary?.items.map((item) => (
              <li
                key={item.id}
                className="flex min-w-[4.5rem] flex-col items-center gap-2"
              >
                <DashboardIntegrationLogo
                  id={item.id}
                  connected={item.connected}
                />
                <span
                  className={cn(
                    "max-w-[5.5rem] text-center text-xs font-medium leading-tight",
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
