"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  isSuperadminLocalDevRuntime,
  liveAppSyncBadgeClass,
  liveAppSyncLabel,
  liveAppVersionSummary,
  localDevRuntimeBadgeClass,
  localDevRuntimeLabel,
  localDevRuntimeSummary,
} from "@/lib/superadmin/superadmin-live-app-sync-ui";
import {
  fetchSuperadminDatabaseStatus,
  fetchSuperadminIntegrationHealth,
} from "@/lib/superadmin/superadmin-ops-status-api";
import type { PlatformIntegrationKey } from "@/lib/types/platform-integration";
import type { SuperadminDatabaseStatus } from "@/lib/types/superadmin-ops-status";
import { cn } from "@/lib/utils";

const INTEGRATION_ALERT_LABELS: Record<PlatformIntegrationKey, string> = {
  google_oauth: "Google OAuth",
  apple_oauth: "Apple OAuth",
  facebook: "Facebook",
  instagram: "Instagram",
  google_business: "Google Business",
  whatsapp: "WhatsApp",
  email: "E-Mail",
  weather: "Wetter",
  fiskaly: "Fiskaly",
  lexoffice: "Lexoffice",
};

type PlatformAlert = {
  key: string;
  label: string;
  detail?: string;
  tone: "error" | "warning";
};

function collectPlatformAlerts(
  status: SuperadminDatabaseStatus,
  integrationErrors: Array<{
    key: PlatformIntegrationKey;
    message?: string;
  }>,
): PlatformAlert[] {
  const alerts: PlatformAlert[] = [];

  if (!status.ok) {
    alerts.push({
      key: "db",
      label: "Datenbank nicht erreichbar",
      detail: status.message,
      tone: "error",
    });
  }

  if (!isSuperadminLocalDevRuntime(status.vps)) {
    if (status.liveApp.syncState === "out_of_sync") {
      alerts.push({
        key: "live-out-of-sync",
        label: "Live-App veraltet",
        detail: status.liveApp.message ?? undefined,
        tone: "error",
      });
    } else if (
      status.liveApp.syncState === "unknown" &&
      !status.liveApp.liveReachable
    ) {
      alerts.push({
        key: "live-unreachable",
        label: "Live-App nicht erreichbar",
        detail: status.liveApp.message ?? undefined,
        tone: "error",
      });
    }
  }

  for (const item of integrationErrors) {
    alerts.push({
      key: `integration-${item.key}`,
      label: INTEGRATION_ALERT_LABELS[item.key],
      detail: item.message,
      tone: "error",
    });
  }

  return alerts;
}

export function SuperadminPlatformStatusSummary() {
  const [status, setStatus] = useState<SuperadminDatabaseStatus | null>(null);
  const [integrationErrors, setIntegrationErrors] = useState<
    Array<{ key: PlatformIntegrationKey; message?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading && !status);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const [dbResult, healthResult] = await Promise.all([
      fetchSuperadminDatabaseStatus(),
      fetchSuperadminIntegrationHealth(),
    ]);

    setStatus(dbResult.status);
    const errors = Object.entries(healthResult.integrations)
      .filter(([, health]) => health?.state === "error")
      .map(([key, health]) => ({
        key: key as PlatformIntegrationKey,
        message: health?.message,
      }));
    setIntegrationErrors(errors);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isLocalDev = status?.vps ? isSuperadminLocalDevRuntime(status.vps) : false;

  const shouldPoll =
    !isLocalDev &&
    (status?.liveApp.syncState === "deploying" ||
      status?.liveApp.syncState === "out_of_sync" ||
      status?.github.appDeployWorkflow.activeRun != null ||
      status?.github.dbDeployWorkflow.activeRun != null);

  useEffect(() => {
    if (!shouldPoll) return;
    const id = window.setInterval(() => void load(true), 12_000);
    return () => window.clearInterval(id);
  }, [shouldPoll, load]);

  const alerts = useMemo(
    () => (status ? collectPlatformAlerts(status, integrationErrors) : []),
    [status, integrationErrors],
  );

  if (showSkeleton) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/50 shadow-card">
        <div className="grid gap-px sm:grid-cols-2">
          <Skeleton className="h-16 rounded-none" />
          <Skeleton className="h-16 rounded-none" />
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Plattform-Status konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 shadow-card">
      <div className="flex items-stretch justify-between gap-2 border-b border-border/40 bg-muted/10 px-3 py-2 sm:px-4">
        <p className="self-center text-xs font-medium text-muted-foreground">
          Plattform-Status
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 rounded-lg"
          disabled={refreshing}
          aria-label="Status aktualisieren"
          onClick={() => void load(true)}
        >
          <RefreshCw
            className={cn("size-4", refreshing && "animate-spin")}
            aria-hidden
          />
        </Button>
      </div>

      <div className="grid gap-px bg-border/40 sm:grid-cols-2">
        <div
          className={cn(
            "px-4 py-3",
            status.ok
              ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
              : "bg-destructive/10 text-destructive",
          )}
        >
          <p className="text-sm font-semibold">
            {status.ok ? "DB läuft" : "DB nicht erreichbar"}
          </p>
          <p className="mt-0.5 text-xs opacity-90">
            {status.ok && status.latencyMs != null
              ? `${status.latencyMs} ms Antwortzeit`
              : (status.message ?? "Verbindung prüfen")}
          </p>
        </div>

        <div
          className={cn(
            "px-4 py-3",
            isLocalDev
              ? localDevRuntimeBadgeClass()
              : liveAppSyncBadgeClass(status.liveApp.syncState),
          )}
        >
          <p className="text-sm font-semibold">
            {isLocalDev
              ? localDevRuntimeLabel()
              : liveAppSyncLabel(status.liveApp.syncState)}
          </p>
          <p className="mt-0.5 text-xs opacity-90">
            {isLocalDev
              ? localDevRuntimeSummary(
                  status.database,
                  status.vps,
                  status.github,
                )
              : liveAppVersionSummary(status.liveApp, status.github)}
          </p>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="space-y-2 border-t border-border/40 bg-destructive/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            Wichtige Hinweise
          </p>
          <ul className="space-y-1.5">
            {alerts.map((alert) => (
              <li
                key={alert.key}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs leading-relaxed",
                  alert.tone === "error"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
                )}
              >
                <span className="font-medium">{alert.label}</span>
                {alert.detail ? (
                  <span className="opacity-90"> — {alert.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
