import type {
  SuperadminGithubRepoStatus,
  SuperadminLiveAppDeployStatus,
  SuperadminLiveAppDeploySyncState,
} from "@/lib/types/superadmin-ops-status";

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
