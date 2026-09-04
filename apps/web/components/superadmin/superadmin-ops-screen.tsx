"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { DeliveryHealthSnapshot } from "@/lib/ops/delivery-health";
import { cn } from "@/lib/utils";

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
          Zustellung, Cron-Lag und WAHA — ohne Secrets.
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
            Pünktlich {slo.onTime} · spät {slo.late} · offen nach 30s {slo.pending}
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
                {job.jobName}
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
                  hängend {row.hungSending} · Retry {row.retrying} · Fehler {row.failedOpen}
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
