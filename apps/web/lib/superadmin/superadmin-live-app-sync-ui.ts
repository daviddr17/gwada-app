import type {
  SuperadminDatabaseDetails,
  SuperadminGithubRepoStatus,
  SuperadminLiveAppDeployStatus,
  SuperadminLiveAppDeploySyncState,
  SuperadminVpsInfo,
} from "@/lib/types/superadmin-ops-status";

export function isSuperadminLocalDevRuntime(vps: SuperadminVpsInfo): boolean {
  return vps.runtime === "development";
}

export function localDevRuntimeLabel(): string {
  return "Lokale Entwicklung";
}

export function localDevRuntimeBadgeClass(): string {
  return "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-200";
}

export function localDevRuntimeSummary(
  database: SuperadminDatabaseDetails,
  vps: SuperadminVpsInfo,
  github: SuperadminGithubRepoStatus,
): string {
  const parts: string[] = ["pnpm dev"];
  if (vps.workspaceSlug) {
    parts.push(`Workspace ${vps.workspaceSlug}`);
  }
  if (database.upstreamHost) {
    parts.push(`DB ${database.upstreamHost}`);
  }
  const head = formatDeploySha(
    github.headCommit.shortSha ?? github.headCommit.sha,
  );
  if (github.configured && head !== "—") {
    parts.push(`GitHub ${head}`);
  }
  parts.push("Live-Sync nur auf VPS");
  return parts.join(" · ");
}

export function formatDeploySha(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 12 ? value.slice(0, 12) : value;
}

export function liveAppSyncLabel(state: SuperadminLiveAppDeploySyncState): string {
  switch (state) {
    case "in_sync":
      return "Live ist aktuell";
    case "out_of_sync":
      return "Live ist veraltet";
    case "deploying":
      return "Deploy läuft";
    default:
      return "Live-Status unklar";
  }
}

export function liveAppSyncBadgeClass(state: SuperadminLiveAppDeploySyncState): string {
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

export function liveAppVersionSummary(
  liveApp: SuperadminLiveAppDeployStatus,
  github: SuperadminGithubRepoStatus,
): string {
  const live = formatDeploySha(liveApp.liveShortSha ?? liveApp.liveSha);
  const head = formatDeploySha(
    github.headCommit.shortSha ?? github.headCommit.sha,
  );

  switch (liveApp.syncState) {
    case "in_sync":
      return `Live = neueste Version (${live})`;
    case "out_of_sync":
      return `Live ${live} · GitHub ${head}`;
    case "deploying":
      return `Deploy läuft · Ziel ${head}`;
    default:
      return liveApp.liveReachable
        ? `Live ${live} · GitHub ${head}`
        : "Live nicht erreichbar";
  }
}
