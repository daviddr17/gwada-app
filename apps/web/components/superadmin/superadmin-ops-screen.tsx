"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  cronJobLabel,
  type DeliveryHealthSnapshot,
} from "@/lib/ops/delivery-health";
import { cn } from "@/lib/utils";

const INTEGRATION_LABELS: Record<string, string> = {
  google_business: "Google Business",
  facebook: "Facebook",
  instagram: "Instagram",
};

function formatWhen(iso: string | null): string {
  if (!iso) return "nie";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatLag(ms: number | null): string {
  if (ms == null) return "kein Heartbeat";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)} min`;
}

export function SuperadminOpsScreen() {
  const [health, setHealth] = useState<DeliveryHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showSkeleton = useDeferredSkeleton(loading && !health);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/superadmin/ops/delivery-health", {
        cache: "no-store",
      });
      if (!res.ok) {
        setError("Ops-Daten konnten nicht geladen werden.");
        return;
      }
      setHealth((await res.json()) as DeliveryHealthSnapshot);
    } catch {
      setError("Ops-Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (showSkeleton) {
    return (
      <div className="space-y-4 px-4 py-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const slo = health?.slo;
  const sloBad = slo?.breached === true;
  const staleCrons = health?.cron.filter((c) => c.stale) ?? [];

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Zustellung, Sync, Integrationen und Billing — ohne Secrets.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Aktualisieren
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <section className="rounded-xl border border-border/50 bg-card px-4 py-4">
        <div className="flex items-center gap-2">
          <Activity className="size-4" />
          <h2 className="font-medium">SLO Bestätigungen</h2>
        </div>
        <p className={cn("mt-2 text-sm", sloBad && "text-destructive")}>
          {slo
            ? `${(slo.ratio * 100).toFixed(1)}% in ${slo.targetMs / 1000}s · Ziel ${slo.targetRatio * 100}% · Stichprobe ${slo.sample}`
            : "Keine Daten"}
        </p>
        {slo ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Letzte 24h, nur Restaurants mit WAHA WORKING · pünktlich {slo.onTime} ·
            spät {slo.late} · offen nach 30s {slo.pending}
          </p>
        ) : null}
        {sloBad ? (
          <p className="mt-2 flex items-center gap-1 text-sm text-destructive">
            <AlertTriangle className="size-4" />
            Unter SLO — Superadmins bekommen eine On-Call-Mail.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border/50 bg-card px-4 py-4">
        <h2 className="font-medium">Cron-Heartbeats</h2>
        {staleCrons.length > 0 ? (
          <p className="mt-1 text-sm text-destructive">
            {staleCrons.length} Job{staleCrons.length === 1 ? "" : "s"} ohne frischen OK-Beat.
            {staleCrons.some((job) => job.pageable)
              ? " Zustell-Jobs lösen On-Call aus."
              : " Nur Sync-Jobs — keine On-Call-Mail."}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Alle überwachten Jobs frisch.</p>
        )}
        <ul className="mt-3 space-y-2 text-sm">
          {(health?.cron ?? []).map((job) => (
            <li
              key={job.jobName}
              className="flex flex-wrap items-baseline justify-between gap-2"
            >
              <span className={job.stale ? "text-destructive" : undefined}>
                {cronJobLabel(job.jobName)}
                {job.stale && !job.pageable ? " · kein On-Call" : ""}
              </span>
              <span className="text-muted-foreground">
                zuletzt ok {formatWhen(job.lastOkAt)} · Lag {formatLag(job.lagMs)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border/50 bg-card px-4 py-4">
        <h2 className="font-medium">Restaurants ohne sauberen Versand</h2>
        {(health?.restaurants.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Keine offenen Fehler, Retries oder Hänger.
          </p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {health?.restaurants.map((row) => (
              <li key={row.restaurantId}>
                <p className="font-medium">{row.restaurantName}</p>
                <p className="text-muted-foreground">
                  WA hängend {row.hungSending} · Retry {row.retrying} · Fehler{" "}
                  {row.failedOpen}
                  {row.emailHungSending + row.emailRetrying + row.emailFailedOpen >
                  0
                    ? ` · E-Mail hängend ${row.emailHungSending} · Retry ${row.emailRetrying} · Fehler ${row.emailFailedOpen}`
                    : ""}
                  {row.notificationsStuck + row.notificationsFailed > 0
                    ? ` · Push hängend ${row.notificationsStuck} · Fehler ${row.notificationsFailed}`
                    : ""}
                  {row.wahaStatus ? ` · WAHA ${row.wahaStatus}` : ""}
                </p>
                {row.lastError ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {row.lastError}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/50 bg-card px-4 py-4">
        <h2 className="font-medium">Integrationen auffällig</h2>
        {(health?.integrations.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Google, Facebook und Instagram ohne Fehlerstatus.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {health?.integrations.map((row) => (
              <li key={`${row.restaurantId}-${row.key}`}>
                <span className="font-medium">{row.restaurantName}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {INTEGRATION_LABELS[row.key] ?? row.key}
                  {row.status ? ` · ${row.status}` : ""}
                  {row.lastError ? ` · ${row.lastError}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/50 bg-card px-4 py-4">
        <h2 className="font-medium">Newsletter-Outbox</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          offen {health?.newsletter.pending ?? 0} · überfällig{" "}
          {health?.newsletter.overdue ?? 0} · Fehler {health?.newsletter.failed ?? 0}
        </p>
        {health?.newsletter.lastError ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {health.newsletter.lastError}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border/50 bg-card px-4 py-4">
        <h2 className="font-medium">Abos im Zahlungsverzug</h2>
        {(health?.billing.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Keine past_due/unpaid Abos.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {health?.billing.map((row) => (
              <li key={row.restaurantId}>
                <span className="font-medium">{row.restaurantName}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {row.status}
                  {row.pastDueSince
                    ? ` seit ${formatWhen(row.pastDueSince)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/50 bg-card px-4 py-4">
        <h2 className="font-medium">WAHA nicht WORKING</h2>
        {(health?.wahaHangs.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Alle Sessions WORKING.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {health?.wahaHangs.map((row) => (
              <li key={row.restaurantId}>
                <span className="font-medium">{row.restaurantName}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {row.status ?? "unbekannt"}
                  {row.lastError ? ` · ${row.lastError}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
