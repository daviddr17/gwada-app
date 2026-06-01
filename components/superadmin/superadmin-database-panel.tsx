"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Rocket } from "lucide-react";
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
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  fetchSuperadminDatabaseStatus,
  triggerSuperadminLiveAppDeploy,
} from "@/lib/superadmin/superadmin-ops-status-api";
import type {
  SuperadminDatabaseStatus,
  SuperadminLiveAppDeploySyncState,
} from "@/lib/types/superadmin-ops-status";
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

function deploySummaryLabel(
  summary: SuperadminDatabaseStatus["coolify"]["liveDeploy"]["summary"],
): string {
  switch (summary) {
    case "deploying":
      return "Deploy läuft";
    case "queued":
      return "In Warteschlange";
    case "idle":
      return "Bereit";
    default:
      return "Nicht verfügbar";
  }
}

function deploySummaryBadgeClass(
  summary: SuperadminDatabaseStatus["coolify"]["liveDeploy"]["summary"],
): string {
  switch (summary) {
    case "deploying":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    case "queued":
      return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200";
    case "idle":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
    default:
      return "border-border/50 bg-muted/40 text-muted-foreground";
  }
}

function liveAppSyncLabel(state: SuperadminLiveAppDeploySyncState): string {
  switch (state) {
    case "in_sync":
      return "Live ist aktuell";
    case "out_of_sync":
      return "Live ist veraltet";
    case "deploying":
      return "Deploy läuft";
    default:
      return "Status unklar";
  }
}

function liveAppSyncBadgeClass(state: SuperadminLiveAppDeploySyncState): string {
  switch (state) {
    case "in_sync":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
    case "out_of_sync":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "deploying":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    default:
      return "border-border/50 bg-muted/40 text-muted-foreground";
  }
}

function githubRunStatusLabel(
  status: string | null,
  conclusion: string | null,
): string {
  if (status === "queued" || status === "waiting" || status === "pending") {
    return "In Warteschlange";
  }
  if (status === "in_progress" || status === "requested") {
    return "Läuft";
  }
  if (status === "completed") {
    if (conclusion === "success") return "Erfolgreich";
    if (conclusion === "failure") return "Fehlgeschlagen";
    if (conclusion === "cancelled") return "Abgebrochen";
    return conclusion ?? "Abgeschlossen";
  }
  return status ?? "—";
}

function formatSha(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 12 ? value.slice(0, 12) : value;
}

function coolifyDeploymentHref(
  dashboardUrl: string | null,
  deploymentUiPath: string | null,
): string | null {
  if (!dashboardUrl || !deploymentUiPath) return null;
  const base = dashboardUrl.replace(/\/+$/, "");
  const path = deploymentUiPath.startsWith("/")
    ? deploymentUiPath
    : `/${deploymentUiPath}`;
  return `${base}${path}`;
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
  const [deploying, setDeploying] = useState(false);
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

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    const { ok, error } = await triggerSuperadminLiveAppDeploy();
    if (ok) {
      toast.success("Deploy gestartet — GitHub Actions baut jetzt auf dem VPS.");
      void load(true);
    } else {
      toast.error(error ?? "Deploy fehlgeschlagen.");
    }
    setDeploying(false);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const shouldPollLive =
    status?.liveApp.syncState === "deploying" ||
    status?.liveApp.syncState === "out_of_sync" ||
    status?.liveApp.githubWorkflow.activeRun != null ||
    status?.coolify.liveDeploy.summary === "deploying" ||
    status?.coolify.liveDeploy.summary === "queued";

  useEffect(() => {
    if (!shouldPollLive) return;
    const id = window.setInterval(() => {
      void load(true);
    }, 8_000);
    return () => window.clearInterval(id);
  }, [shouldPollLive, load]);

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
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Live-App & Deployment</CardTitle>
            <CardDescription>
              Welcher Git-Commit öffentlich läuft, ob ein Deploy aktiv ist, und
              Infrastruktur auf dem VPS — ohne Secrets.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <Button
              type="button"
              size="sm"
              className={cn("rounded-xl", settingsAccentSaveButtonClassName)}
              disabled={
                deploying ||
                !status.liveApp.triggerConfigured ||
                status.liveApp.syncState === "deploying" ||
                Boolean(status.liveApp.githubWorkflow.activeRun)
              }
              onClick={() => void handleDeploy()}
            >
              <Rocket
                className={cn("mr-1.5 size-4", deploying && "animate-pulse")}
              />
              {deploying ? "Startet …" : "Deploy starten"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn(
              "rounded-xl border p-4",
              liveAppSyncBadgeClass(status.liveApp.syncState),
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {liveAppSyncLabel(status.liveApp.syncState)}
              </p>
              {shouldPollLive ? (
                <span className="text-xs opacity-80">Auto-Aktualisierung …</span>
              ) : null}
            </div>
            {status.liveApp.message ? (
              <p className="mt-1.5 text-xs leading-relaxed opacity-90">
                {status.liveApp.message}
              </p>
            ) : null}
          </div>

          <dl className="grid gap-3">
            <InfoRow
              label="Live (öffentlich)"
              value={
                <span className="font-mono text-xs">
                  {formatSha(status.liveApp.liveShortSha ?? status.liveApp.liveSha)}
                  {status.liveApp.siteUrl ? (
                    <a
                      href={`${status.liveApp.siteUrl.replace(/\/+$/, "")}/api/build-info`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 font-sans text-foreground underline-offset-4 hover:underline"
                    >
                      build-info
                      <ExternalLink className="size-3 opacity-60" aria-hidden />
                    </a>
                  ) : null}
                </span>
              }
            />
            <InfoRow
              label="GitHub main"
              value={
                <span className="font-mono text-xs">
                  {formatSha(
                    status.liveApp.githubShortSha ?? status.liveApp.githubSha,
                  )}
                  {status.liveApp.githubCommitMessage ? (
                    <span className="ml-2 font-sans text-muted-foreground">
                      {status.liveApp.githubCommitMessage.length > 48
                        ? `${status.liveApp.githubCommitMessage.slice(0, 48)}…`
                        : status.liveApp.githubCommitMessage}
                    </span>
                  ) : null}
                </span>
              }
            />
            <InfoRow
              label="Container (GWADA_BUILD_SHA)"
              value={formatSha(status.liveApp.containerSha)}
              mono
            />
            <InfoRow
              label="GitHub Actions"
              value={
                status.liveApp.githubWorkflow.configured ? (
                  status.liveApp.githubWorkflow.activeRun ? (
                    <span>
                      <span className="font-medium">
                        {githubRunStatusLabel(
                          status.liveApp.githubWorkflow.activeRun.status,
                          status.liveApp.githubWorkflow.activeRun.conclusion,
                        )}
                      </span>
                      {status.liveApp.githubWorkflow.activeRun.headSha ? (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {formatSha(
                            status.liveApp.githubWorkflow.activeRun.headSha,
                          )}
                        </span>
                      ) : null}
                      {status.liveApp.githubWorkflow.activeRun.htmlUrl ? (
                        <a
                          href={status.liveApp.githubWorkflow.activeRun.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                        >
                          Logs
                          <ExternalLink className="size-3 opacity-60" aria-hidden />
                        </a>
                      ) : null}
                    </span>
                  ) : status.liveApp.githubWorkflow.latestRun ? (
                    <span>
                      <span className="font-medium">
                        {githubRunStatusLabel(
                          status.liveApp.githubWorkflow.latestRun.status,
                          status.liveApp.githubWorkflow.latestRun.conclusion,
                        )}
                      </span>
                      {status.liveApp.githubWorkflow.latestRun.updatedAt ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatCheckedAt(
                            status.liveApp.githubWorkflow.latestRun.updatedAt,
                          )}
                        </span>
                      ) : null}
                      {status.liveApp.githubWorkflow.latestRun.htmlUrl ? (
                        <a
                          href={status.liveApp.githubWorkflow.latestRun.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                        >
                          Logs
                          <ExternalLink className="size-3 opacity-60" aria-hidden />
                        </a>
                      ) : null}
                    </span>
                  ) : (
                    "Noch kein Lauf"
                  )
                ) : (
                  "GITHUB_DEPLOY_TOKEN fehlt"
                )
              }
            />
            {!status.liveApp.triggerConfigured ? (
              <p className="text-xs text-muted-foreground">
                Für „Deploy starten“ und Actions-Status{" "}
                <span className="font-mono">GITHUB_DEPLOY_TOKEN</span> in Coolify
                setzen (repo + workflow). SSH-Deploy zusätzlich: GitHub Secrets{" "}
                <span className="font-mono">LIVE_SSH_KEY</span> +{" "}
                <span className="font-mono">LIVE_VPS_HOST</span>.
              </p>
            ) : null}
            {status.liveApp.githubWorkflow.message ? (
              <p className="text-xs text-muted-foreground">
                {status.liveApp.githubWorkflow.message}
              </p>
            ) : null}
          </dl>

          <div className="border-t border-border/50 pt-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              Coolify & Infrastruktur
            </p>
            <dl className="grid gap-3">
            <InfoRow
              label="Coolify Deploy-Status"
              value={
                <span
                  className={cn(
                    "inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium",
                    deploySummaryBadgeClass(status.coolify.liveDeploy.summary),
                  )}
                >
                  {deploySummaryLabel(status.coolify.liveDeploy.summary)}
                </span>
              }
            />
            {status.coolify.liveDeploy.active.length > 0 ? (
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Aktive Coolify-Deployments
                </p>
                <ul className="space-y-2">
                  {status.coolify.liveDeploy.active.map((dep) => {
                    const href = coolifyDeploymentHref(
                      status.coolify.dashboardUrl,
                      dep.deploymentUiPath,
                    );
                    return (
                      <li
                        key={dep.deploymentUuid ?? dep.commit ?? dep.status}
                        className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span>
                          <span className="font-medium capitalize">
                            {dep.status.replace(/_/g, " ")}
                          </span>
                          {dep.commit ? (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {dep.commit.slice(0, 12)}
                            </span>
                          ) : null}
                        </span>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-foreground underline-offset-4 hover:underline"
                          >
                            In Coolify öffnen
                            <ExternalLink
                              className="size-3 opacity-60"
                              aria-hidden
                            />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {status.coolify.liveDeploy.message ? (
              <p className="text-xs text-muted-foreground">
                {status.coolify.liveDeploy.message}
              </p>
            ) : null}
            <InfoRow
              label="Coolify App-Status"
              value={status.coolify.liveDeploy.appRuntimeStatus ?? "—"}
            />
            <InfoRow
              label="Coolify-Deploy"
              value={
                status.coolify.detected
                  ? "Ja (VPS / Proxy-Env)"
                  : "Nein (lokal oder ohne Coolify-Env)"
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
                  <span className="flex flex-col items-end gap-1 text-right">
                    <InfoRowLink
                      href={status.coolify.supabaseStudioHint}
                      label={status.coolify.supabaseStudioHint}
                    />
                    {status.coolify.supabaseStudioAccessNote ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {status.coolify.supabaseStudioAccessNote}
                      </span>
                    ) : null}
                  </span>
                ) : status.coolify.supabaseStudioAccessNote ? (
                  <span className="text-right text-xs font-normal text-muted-foreground">
                    {status.coolify.supabaseStudioAccessNote}
                  </span>
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
              label="Coolify-UI"
              value={
                status.coolify.dashboardUrl ? (
                  <InfoRowLink
                    href={status.coolify.dashboardUrl}
                    label={status.coolify.dashboardUrl}
                  />
                ) : (
                  "Optional: GWADA_COOLIFY_DASHBOARD_URL (nicht COOLIFY_URL — das ist die App)"
                )
              }
            />
            <InfoRow
              label="App-UUID"
              value={status.coolify.applicationUuid ?? "—"}
              mono
            />
            <InfoRow
              label="Deploy-Branch"
              value={status.coolify.deployBranch ?? "—"}
            />
            <InfoRow
              label="Letztes Coolify-Deploy"
              value={
                status.coolify.liveDeploy.lastDeploy.finishedAt ? (
                  <span>
                    {formatCheckedAt(
                      status.coolify.liveDeploy.lastDeploy.finishedAt,
                    )}
                    {status.coolify.liveDeploy.lastDeploy.commit ? (
                      <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                        {status.coolify.liveDeploy.lastDeploy.commit.slice(
                          0,
                          12,
                        )}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <InfoRow
              label="Build-Commit (Container-Env)"
              value={
                status.coolify.sourceCommit ? (
                  <span className="font-mono text-xs font-normal">
                    {status.coolify.sourceCommit.slice(0, 12)}
                    <span className="ml-1 font-sans text-muted-foreground">
                      (SOURCE_COMMIT)
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
          </dl>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
