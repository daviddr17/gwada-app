"use client";

import { MessageCircle } from "lucide-react";
import {
  DashboardStatBlock,
  DashboardWidgetStatsGrid,
} from "@/components/dashboard/dashboard-stat-block";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardMessagesStats } from "@/lib/hooks/use-dashboard-messages-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function DashboardMessagesTile() {
  const { summary, loading, error, ready } = useDashboardMessagesStats();
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  return (
    <DashboardWidgetShell
      title="Nachrichten"
      icon={
        <MessageCircle
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/kontakte/nachrichten?platform=gwada"
      linkLabel="Zu Nachrichten"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      <DashboardWidgetStatsGrid columns={2}>
        <DashboardStatBlock
          size="compact"
          label="Ungelesen gesamt"
          primary={String(summary?.total_unread ?? 0)}
          secondary="Alle aktiven Kanäle"
        />
        <DashboardStatBlock
          size="compact"
          label="Gwada"
          primary={String(summary?.gwada_unread ?? 0)}
          secondary="Nachrichten im System"
        />
        <DashboardStatBlock
          size="compact"
          label="WhatsApp"
          primary={String(summary?.whatsapp_unread ?? 0)}
          secondary="Vom verbundenen Konto"
        />
      </DashboardWidgetStatsGrid>
    </DashboardWidgetShell>
  );
}
