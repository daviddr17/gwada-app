"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchSuperadminDatabaseStatus } from "@/lib/superadmin/superadmin-ops-status-api";
import type { SuperadminDatabaseStatus } from "@/lib/types/superadmin-ops-status";
import { cn } from "@/lib/utils";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        ok ? "bg-emerald-500" : "bg-destructive",
      )}
      aria-hidden
    />
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm font-medium text-foreground",
          mono && "break-all font-mono text-xs font-normal",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function InfoRowLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 break-all font-mono text-xs font-normal text-foreground underline-offset-4 hover:underline"
    >
      {label}
      <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
    </a>
  );
}

function formatCheckedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function DatabasePanelSkeleton() {
  return (
    <SkeletonCardFrame className="space-y-4 p-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </SkeletonCardFrame>
  );
}

export function SuperadminDatabasePanel() {
  const [status, setStatus] = useState<SuperadminDatabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading && !status);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const { status: data, error } = await fetchSuperadminDatabaseStatus();
    if (error) toast.error(error);
    setStatus(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (showSkeleton) {
    return <DatabasePanelSkeleton />;
  }

  if (!status) {
    return (
      <Card className="border-border/50 shadow-card">
        <CardContent className="py-8 text-sm text-muted-foreground">
          Datenbankstatus konnte nicht geladen werden.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Plattform-Daten</CardTitle>
          <CardDescription>
            Grobe Bestände über Service-Role (nur Superadmin).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-3">
            <InfoRow
              label="Restaurants"
              value={status.counts.restaurants ?? "—"}
            />
            <InfoRow label="Profile" value={status.counts.profiles ?? "—"} />
            <InfoRow
              label="Superadmins"
              value={status.counts.platformSuperadmins ?? "—"}
            />
          </dl>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <StatusDot ok={status.ok} />
              Verbindung
            </CardTitle>
            <CardDescription>
              {status.ok
                ? "Supabase-API antwortet. Die Ping-Zeit misst nur eine minimale Abfrage — echte Module laden mehr Daten und brauchen länger."
                : (status.message ?? "Keine Verbindung zur Datenbank.")}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            <RefreshCw
              className={cn("mr-1.5 size-4", refreshing && "animate-spin")}
            />
            Aktualisieren
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoRow
              label="Status"
              value={status.ok ? "Aktiv" : "Nicht erreichbar"}
            />
            <InfoRow
              label="Ping (1 Datensatz)"
              value={
                status.latencyMs != null ? `${status.latencyMs} ms` : "—"
              }
            />
            <InfoRow
              label="Zähl-Abfragen"
              value={
                status.countsLatencyMs != null
                  ? `${status.countsLatencyMs} ms`
                  : "—"
              }
            />
            <InfoRow
              label="Status-Check gesamt"
              value={
                status.totalCheckLatencyMs != null
                  ? `${status.totalCheckLatencyMs} ms`
                  : "—"
              }
            />
            <InfoRow
              label="Zuletzt geprüft"
              value={formatCheckedAt(status.checkedAt)}
            />
            <InfoRow
              label="Service-Role"
              value={
                status.server.serviceRoleConfigured
                  ? "Konfiguriert"
                  : "Fehlt"
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Adresse & Routing</CardTitle>
          <CardDescription>
            Öffentliche Endpunkte — keine Secrets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3">
            <InfoRow
              label="Supabase API-URL"
              value={status.api.publicUrl ?? "—"}
              mono
            />
            <InfoRow
              label="Proxy (/sb)"
              value={status.api.proxyEnabled ? "Ja" : "Nein"}
            />
            <InfoRow
              label="Site-URL"
              value={status.api.siteUrl ?? "—"}
              mono
            />
            <InfoRow
              label="Workspace-Slug"
              value={status.api.workspaceSlug ?? "—"}
            />
            <InfoRow
              label="Upstream konfiguriert"
              value={
                status.server.supabaseUpstreamConfigured ? "Ja" : "Nein"
              }
            />
            <InfoRow
              label="Supabase-only Modus"
              value={status.server.supabaseOnlyMode ? "Ja" : "Nein"}
            />
          </dl>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Coolify / Deployment</CardTitle>
          <CardDescription>
            Laufzeit-Container und öffentliche Endpunkte auf dem VPS — keine
            Secrets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3">
            <InfoRow
              label="Erkannt"
              value={
                status.coolify.detected
                  ? "Ja"
                  : "Nein (lokal oder ohne Proxy)"
              }
            />
            <InfoRow
              label="Laufzeit"
              value={
                status.coolify.runtime === "production"
                  ? "Production"
                  : "Entwicklung"
              }
            />
            <InfoRow
              label="Phase"
              value={
                status.coolify.deploymentPhase === "staging"
                  ? "Staging (new.gwada.app)"
                  : status.coolify.deploymentPhase === "production"
                    ? "Production (gwada.app)"
                    : "Entwicklung"
              }
            />
            <InfoRow
              label="Geplante Live-Domain"
              value={
                status.coolify.plannedProductionUrl ? (
                  <InfoRowLink
                    href={status.coolify.plannedProductionUrl}
                    label={status.coolify.plannedProductionUrl}
                  />
                ) : (
                  "—"
                )
              }
            />
            <InfoRow
              label="App-URL"
              value={
                status.coolify.appUrl ? (
                  <InfoRowLink
                    href={status.coolify.appUrl}
                    label={status.coolify.appUrl}
                  />
                ) : (
                  "—"
                )
              }
            />
            <InfoRow
              label="Supabase Kong (Upstream)"
              value={
                status.coolify.supabaseUpstream ? (
                  <InfoRowLink
                    href={status.coolify.supabaseUpstream}
                    label={status.coolify.supabaseUpstream}
                  />
                ) : (
                  "—"
                )
              }
            />
            <InfoRow
              label="Supabase Studio"
              value={
                status.coolify.supabaseStudioHint ? (
                  <InfoRowLink
                    href={status.coolify.supabaseStudioHint}
                    label={status.coolify.supabaseStudioHint}
                  />
                ) : (
                  "—"
                )
              }
            />
            <InfoRow
              label="Proxy (/sb)"
              value={status.coolify.proxyEnabled ? "Ja" : "Nein"}
            />
            <InfoRow
              label="Coolify-Dashboard"
              value={
                status.coolify.dashboardUrl ? (
                  <InfoRowLink
                    href={status.coolify.dashboardUrl}
                    label={status.coolify.dashboardUrl}
                  />
                ) : (
                  "Optional: GWADA_COOLIFY_DASHBOARD_URL"
                )
              }
            />
            <InfoRow
              label="Deploy-Branch"
              value={status.coolify.deployBranch ?? "—"}
            />
            <InfoRow
              label="Commit"
              value={
                status.coolify.sourceCommit ? (
                  <span className="font-mono text-xs font-normal">
                    {status.coolify.sourceCommit.slice(0, 12)}
                  </span>
                ) : (
                  "—"
                )
              }
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
