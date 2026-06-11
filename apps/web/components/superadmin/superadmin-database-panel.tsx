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
  SuperadminGithubDeployWorkflowRun,
  SuperadminGithubDeployWorkflowStatus,
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

function SectionIntro({
  what,
  does,
}: {
  what: string;
  does: string;
}) {
  return (
    <div className="space-y-1">
      <CardDescription>{what}</CardDescription>
      <p className="text-xs leading-relaxed text-muted-foreground">{does}</p>
    </div>
  );
}

function formatCheckedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function formatSha(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 12 ? value.slice(0, 12) : value;
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

function deploymentPhaseLabel(
  phase: SuperadminDatabaseStatus["vps"]["deploymentPhase"],
): string {
  switch (phase) {
    case "staging":
      return "Staging (new.gwada.app)";
    case "production":
      return "Production (gwada.app)";
    default:
      return "Entwicklung (lokal)";
  }
}

function WorkflowRunSummary({
  workflow,
}: {
  workflow: SuperadminGithubDeployWorkflowStatus;
}) {
  const run: SuperadminGithubDeployWorkflowRun | null =
    workflow.activeRun ?? workflow.latestRun;

  if (!workflow.configured) {
    return (
      <span className="text-muted-foreground">
        GITHUB_DEPLOY_TOKEN fehlt
      </span>
    );
  }

  if (!run) {
    return <span className="text-muted-foreground">Noch kein Lauf</span>;
  }

  return (
    <span>
      <span className="font-medium">
        {githubRunStatusLabel(run.status, run.conclusion)}
      </span>
      {run.updatedAt ? (
        <span className="ml-2 text-xs text-muted-foreground">
          {formatCheckedAt(run.updatedAt)}
        </span>
      ) : null}
      {run.headSha ? (
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {formatSha(run.headSha)}
        </span>
      ) : null}
      {run.htmlUrl ? (
        <a
          href={run.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
        >
          Logs
          <ExternalLink className="size-3 opacity-60" aria-hidden />
        </a>
      ) : null}
    </span>
  );
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
    status?.github.appDeployWorkflow.activeRun != null ||
    status?.github.dbDeployWorkflow.activeRun != null;

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

  const github = status.github;
  const head = github.headCommit;

  return (
    <div className="space-y-4">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Live & Deploy</CardTitle>
            <SectionIntro
              what="Ist die öffentliche App auf dem Stand von GitHub main?"
              does="Push auf main startet deploy-live-app.yml (SSH → VPS). Hier siehst du den Sync-Status, den laufenden Commit und kannst manuell deployen."
            />
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
                Boolean(github.appDeployWorkflow.activeRun)
              }
              onClick={() => void handleDeploy()}
            >
              <Rocket
                className={cn("mr-1.5 size-4", deploying && "animate-pulse")}
              />
              {deploying ? "Startet …" : "App deployen"}
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

          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoRow
              label="Live (build-info)"
              value={
                <span className="font-mono text-xs">
                  {formatSha(
                    status.liveApp.liveShortSha ?? status.liveApp.liveSha,
                  )}
                  {status.liveApp.siteUrl ? (
                    <a
                      href={`${status.liveApp.siteUrl.replace(/\/+$/, "")}/api/build-info`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 font-sans text-foreground underline-offset-4 hover:underline"
                    >
                      öffnen
                      <ExternalLink className="size-3 opacity-60" aria-hidden />
                    </a>
                  ) : null}
                </span>
              }
            />
            <InfoRow
              label={`GitHub ${github.deployBranch}`}
              value={
                <span className="font-mono text-xs">
                  {formatSha(head.shortSha ?? head.sha)}
                  {head.htmlUrl ? (
                    <a
                      href={head.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 font-sans text-foreground underline-offset-4 hover:underline"
                    >
                      Commit
                      <ExternalLink className="size-3 opacity-60" aria-hidden />
                    </a>
                  ) : null}
                </span>
              }
            />
            <InfoRow
              label="Letzter Commit"
              value={
                head.message ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    {head.message.length > 64
                      ? `${head.message.slice(0, 64)}…`
                      : head.message}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <InfoRow
              label="Commit-Zeit"
              value={formatCheckedAt(head.committedAt)}
            />
            <InfoRow label="Autor" value={head.author ?? "—"} />
            <InfoRow
              label="Repo zuletzt gepusht"
              value={formatCheckedAt(github.pushedAt)}
            />
            <InfoRow
              label="Container (GWADA_BUILD_SHA)"
              value={formatSha(status.liveApp.containerSha)}
              mono
            />
            <InfoRow
              label="Deploy-Log (VPS)"
              value={
                <span className="font-mono text-xs font-normal">
                  {status.liveApp.deployLogHint}
                </span>
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">GitHub</CardTitle>
          <SectionIntro
            what="Quellcode, Branches und CI/CD im Repo."
            does="Zeigt alle Branches, den letzten main-Commit und die GitHub Actions für App- und DB-Deploy — ohne Tokens oder Secrets."
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3">
            <InfoRow
              label="Repository"
              value={
                <InfoRowLink href={github.htmlUrl} label={github.slug} />
              }
            />
            <InfoRow
              label="Deploy-Branch"
              value={
                <span>
                  <span className="font-mono text-xs">{github.deployBranch}</span>
                  {github.deployBranch !== github.defaultBranch ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Default: {github.defaultBranch})
                    </span>
                  ) : null}
                </span>
              }
            />
            {github.description ? (
              <InfoRow label="Beschreibung" value={github.description} />
            ) : null}
            <InfoRow
              label="Workflow App live"
              value={<WorkflowRunSummary workflow={github.appDeployWorkflow} />}
            />
            <InfoRow
              label="Workflow DB live"
              value={<WorkflowRunSummary workflow={github.dbDeployWorkflow} />}
            />
          </dl>

          {github.branches.length > 0 ? (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Branches ({github.branches.length})
              </p>
              <ul className="divide-y divide-border/40">
                {github.branches.map((branch) => (
                  <li
                    key={branch.name}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="font-medium">
                      {branch.name}
                      {branch.isDefault ? (
                        <span className="ml-2 rounded-md border border-border/50 bg-background px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          default
                        </span>
                      ) : null}
                      {branch.protected ? (
                        <span className="ml-1 rounded-md border border-border/50 bg-background px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          protected
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {branch.shortSha}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : github.message ? (
            <p className="text-xs text-muted-foreground">{github.message}</p>
          ) : null}

          {!status.liveApp.triggerConfigured ? (
            <p className="text-xs text-muted-foreground">
              Für Deploy-Button und Branch-Liste{" "}
              <span className="font-mono">GITHUB_DEPLOY_TOKEN</span> in der
              App-Env setzen (Contents read + Actions read/write). SSH-Deploy
              zusätzlich als GitHub Secrets:{" "}
              <span className="font-mono">LIVE_SSH_KEY</span>,{" "}
              <span className="font-mono">LIVE_VPS_HOST</span>.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <StatusDot ok={status.ok} />
              Datenbank
            </CardTitle>
            <SectionIntro
              what="Supabase Postgres — Erreichbarkeit und Endpunkte."
              does="Prüft die DB-Verbindung, zeigt API-URL und Studio-Zugang. Schema-Änderungen liegen in supabase/migrations/ und gehen live über deploy-live-db.yml."
            />
            {!status.ok && status.message ? (
              <p className="text-xs text-destructive">{status.message}</p>
            ) : null}
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3">
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
                label="API-URL (Browser)"
                value={status.database.publicUrl ?? "—"}
                mono
              />
              <InfoRow
                label="Proxy (/sb)"
                value={status.database.proxyEnabled ? "Ja" : "Nein"}
              />
              <InfoRow
                label="Kong Upstream"
                value={status.database.upstreamHost ?? "—"}
                mono
              />
              <InfoRow
                label="Migrationen im Repo"
                value={status.database.migrationFilesCount ?? "—"}
              />
              <InfoRow
                label="Service-Role"
                value={
                  status.database.serviceRoleConfigured
                    ? "Konfiguriert"
                    : "Fehlt"
                }
              />
              <InfoRow
                label="Supabase-only Modus"
                value={status.database.supabaseOnlyMode ? "Ja" : "Nein"}
              />
              <InfoRow
                label="Supabase Studio"
                value={
                  status.database.studioUrl ? (
                    <span className="flex flex-col gap-1">
                      <InfoRowLink
                        href={status.database.studioUrl}
                        label={status.database.studioUrl}
                      />
                      {status.database.studioAccessNote ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          {status.database.studioAccessNote}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    (status.database.studioAccessNote ?? "—")
                  )
                }
              />
              <InfoRow
                label="Zuletzt geprüft"
                value={formatCheckedAt(status.checkedAt)}
              />
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">VPS (Contabo)</CardTitle>
            <SectionIntro
              what="Der physische Server unter new.gwada.app."
              does="Hier laufen die Next.js-App (Docker), Supabase und Traefik. GitHub Actions verbindet sich per SSH und tauscht Container aus."
            />
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3">
              <InfoRow label="Anbieter" value={status.vps.provider} />
              <InfoRow
                label="Host / IP"
                value={status.vps.publicHost ?? "—"}
                mono
              />
              <InfoRow
                label="SSH"
                value={
                  status.vps.publicHost ? (
                    <span className="font-mono text-xs font-normal">
                      ssh {status.vps.sshUser}@{status.vps.publicHost}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Phase"
                value={deploymentPhaseLabel(status.vps.deploymentPhase)}
              />
              <InfoRow
                label="Laufzeit"
                value={
                  status.vps.runtime === "production"
                    ? "Production"
                    : "Entwicklung"
                }
              />
              <InfoRow
                label="App-URL"
                value={
                  status.vps.siteUrl ? (
                    <InfoRowLink
                      href={status.vps.siteUrl}
                      label={status.vps.siteUrl}
                    />
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Geplante Production"
                value={
                  status.vps.plannedProductionUrl ? (
                    <InfoRowLink
                      href={status.vps.plannedProductionUrl}
                      label={status.vps.plannedProductionUrl}
                    />
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Workspace-Slug"
                value={status.vps.workspaceSlug ?? "—"}
              />
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Coolify</CardTitle>
            <SectionIntro
              what="Docker-Panel auf dem VPS — nur noch Infrastruktur."
              does="Coolify hostet ggf. Env-Variablen und den Supabase-Docker-Stack. App-Deploys laufen nicht mehr über Coolify, sondern über GitHub Actions."
            />
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3">
              <InfoRow
                label="App-Deploy"
                value="GitHub Actions (deploy-live-app.yml)"
              />
              <InfoRow
                label="Coolify auf Server"
                value={
                  status.coolify.hostingDetected
                    ? "Erkannt (Hosting/Env)"
                    : "Nicht erkannt (lokal)"
                }
              />
              <InfoRow
                label="Supabase Docker-Stack"
                value={
                  status.coolify.supabaseDockerStack
                    ? "Ja (Kong im Docker-Netz)"
                    : "Nein / lokal"
                }
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
                    "Optional: GWADA_COOLIFY_DASHBOARD_URL"
                  )
                }
              />
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Coolify-Deploy-Webhook und Build-Queue für die App nicht mehr
              nutzen — sonst kann „finished“ angezeigt werden, während live noch
              ein altes Image läuft.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Repository</CardTitle>
          <SectionIntro
            what="Orientierung im gwada-app Monorepo."
            does="Wichtigste Ordner und Docs für Entwickler — Links führen direkt zu GitHub (main)."
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <p className="mb-3 font-mono text-xs text-muted-foreground">
              {status.repository.repoSlug} ({status.repository.defaultBranch})
            </p>
            <ul className="space-y-2">
              {status.repository.tree.map((entry) => (
                <li
                  key={entry.path}
                  className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <a
                    href={`${status.repository.repoUrl}/tree/${status.repository.defaultBranch}/${entry.path.replace(/\/$/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-foreground underline-offset-4 hover:underline"
                  >
                    {entry.path}
                    <ExternalLink className="size-3 opacity-60" aria-hidden />
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {entry.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Docs für Entwickler
            </p>
            <ul className="flex flex-wrap gap-2">
              {status.repository.docLinks.map((doc) => (
                <li key={doc.path}>
                  <a
                    href={`${status.repository.repoUrl}/blob/${status.repository.defaultBranch}/${doc.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1 text-xs text-foreground underline-offset-4 hover:underline"
                  >
                    {doc.label}
                    <ExternalLink className="size-3 opacity-60" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Plattform-Daten</CardTitle>
          <SectionIntro
            what="Grobe Bestände in der Production-Datenbank."
            does="Zählt Restaurants, Nutzerprofile und Superadmins über die Service-Role — nur zur schnellen Plausibilitätsprüfung."
          />
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
    </div>
  );
}
