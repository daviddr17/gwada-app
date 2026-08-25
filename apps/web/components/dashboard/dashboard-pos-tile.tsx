"use client";

import { MonitorSmartphone } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { formatEurFromCents } from "@/lib/billing/billing-status-labels";
import { useDashboardModuleBatchStats } from "@/lib/hooks/use-dashboard-module-batch-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { isPosLiveForViewer } from "@/lib/pos/pos-coming-soon";

export function DashboardPosTile() {
  const { isSuperadmin, loading: superadminLoading } = useIsSuperadmin();
  const showGateSkeleton = useDeferredSkeleton(superadminLoading);

  if (superadminLoading) {
    if (!showGateSkeleton) {
      return <div className="min-h-[8.5rem]" aria-busy="true" />;
    }
    return (
      <DashboardWidgetShell
        title="POS"
        icon={
          <MonitorSmartphone
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        }
        href="/dashboard/pos/uebersicht"
        linkLabel="Zum POS"
        ready={false}
        loading
        error={null}
      >
        {null}
      </DashboardWidgetShell>
    );
  }

  if (!isPosLiveForViewer(isSuperadmin)) {
    return <DashboardPosComingSoonTile />;
  }

  return <DashboardPosLiveTile />;
}

function DashboardPosComingSoonTile() {
  return (
    <DashboardWidgetShell
      title="POS"
      icon={
        <MonitorSmartphone
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/pos/uebersicht"
      linkLabel="Zum POS"
      ready
      loading={false}
      error={null}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill label="Status" value="Coming soon" />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}

function DashboardPosLiveTile() {
  const { summary, loading, error, ready } = useDashboardModuleBatchStats("pos");
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const openSessions = summary?.openSessions ?? 0;

  return (
    <DashboardWidgetShell
      title="POS"
      icon={
        <MonitorSmartphone
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/pos/uebersicht"
      linkLabel="Zum POS"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardCompactInlineMetrics>
        <DashboardCompactMetricPill
          label="Umsatz heute"
          value={formatEurFromCents(summary?.revenueCentsToday ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Bons heute"
          value={String(summary?.ordersToday ?? 0)}
        />
        <DashboardCompactMetricPill
          label="Ø Bon"
          value={
            summary?.avgTicketCentsToday != null
              ? formatEurFromCents(summary.avgTicketCentsToday)
              : "—"
          }
        />
        <DashboardCompactMetricPill
          label="Offene Tische"
          value={String(openSessions)}
          href="/dashboard/pos/bestellungen"
          highlight={openSessions > 0}
        />
      </DashboardCompactInlineMetrics>
    </DashboardWidgetShell>
  );
}
