import "server-only";

import { getPublicSiteUrl } from "@/lib/public-env";
import type {
  SuperadminGithubRepoStatus,
  SuperadminLiveAppDeployStatus,
} from "@/lib/types/superadmin-ops-status";
import { raceWithTimeout } from "@/lib/supabase/race-timeout";
import { githubDeployTokenStrict } from "@/lib/superadmin/github-deploy-api-server";

const BUILD_INFO_TIMEOUT_MS = 6_000;

/** Nur echte Git-SHAs (kurz oder voll) — kein „dev“, kein „—“. */
export function normalizeSha(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed || trimmed === "dev") return null;
  if (!/^[0-9a-f]{4,40}$/.test(trimmed)) return null;
  return trimmed;
}

export function shasMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeSha(a);
  const nb = normalizeSha(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.startsWith(nb) || nb.startsWith(na);
}

/**
 * Erwarteter GitHub-Stand für den Live-Vergleich.
 * Fallback: Deploy-Branch-Tip aus Branch-Liste, dann letzter App-Deploy-Run.
 */
export function resolveGithubCompareSha(
  github: SuperadminGithubRepoStatus,
): string | null {
  const fromHead = normalizeSha(
    github.headCommit.sha ?? github.headCommit.shortSha,
  );
  if (fromHead) return fromHead;

  const branchTip = github.branches.find(
    (b) => b.name === github.deployBranch || b.isDefault,
  );
  const fromBranch = normalizeSha(branchTip?.shortSha);
  if (fromBranch) return fromBranch;

  const latest = github.appDeployWorkflow.latestRun;
  if (latest) {
    const fromRun = normalizeSha(latest.headSha);
    if (fromRun) return fromRun;
  }

  return null;
}

async function fetchLiveBuildInfo(
  siteUrl: string,
): Promise<{
  sha: string | null;
  shortSha: string | null;
  reachable: boolean;
  message: string | null;
}> {
  const origin = siteUrl.replace(/\/+$/, "");
  try {
    const res = await raceWithTimeout(
      fetch(`${origin}/api/build-info`, { cache: "no-store" }),
      BUILD_INFO_TIMEOUT_MS,
      "Live build-info",
    );

    if (!res.ok) {
      return {
        sha: null,
        shortSha: null,
        reachable: false,
        message: `Live /api/build-info antwortet mit ${res.status}.`,
      };
    }

    const body = (await res.json()) as { sha?: string };
    const raw = body.sha?.trim() || null;
    const normalized = normalizeSha(raw);
    return {
      sha: normalized,
      shortSha: normalized ? normalized.slice(0, 7) : null,
      reachable: true,
      message: normalized ? null : "Live /api/build-info ohne gültigen Commit-SHA.",
    };
  } catch {
    return {
      sha: null,
      shortSha: null,
      reachable: false,
      message: "Live-App nicht erreichbar (/api/build-info).",
    };
  }
}

export function deriveLiveAppSyncState(input: {
  liveSha: string | null;
  githubSha: string | null;
  github: SuperadminGithubRepoStatus;
}): SuperadminLiveAppDeployStatus["syncState"] {
  const githubActive = Boolean(
    input.github.appDeployWorkflow.activeRun ||
      input.github.dbDeployWorkflow.activeRun,
  );

  if (githubActive) return "deploying";

  if (input.liveSha && input.githubSha) {
    return shasMatch(input.liveSha, input.githubSha) ? "in_sync" : "out_of_sync";
  }

  return "unknown";
}

function buildMessage(input: {
  syncState: SuperadminLiveAppDeployStatus["syncState"];
  liveReachable: boolean;
  liveSha: string | null;
  githubSha: string | null;
  github: SuperadminGithubRepoStatus;
}): string | null {
  if (input.syncState === "in_sync") {
    return "Live-App entspricht dem neuesten Commit auf GitHub main.";
  }

  if (input.syncState === "deploying") {
    if (input.github.appDeployWorkflow.activeRun) {
      return "GitHub Actions baut das Image und deployt es auf den VPS (Build → ghcr.io → pull).";
    }
    if (input.github.dbDeployWorkflow.activeRun) {
      return "GitHub Actions wendet gerade DB-Migrationen auf live an.";
    }
    return "Deploy läuft — Live-Commit wird gleich aktualisiert.";
  }

  if (input.syncState === "out_of_sync") {
    return "Live-App ist veraltet: öffentliche URL liefert einen älteren Build als GitHub main. Nach Commit/Push hier „App deployen“ starten.";
  }

  if (!input.liveReachable && !input.liveSha) {
    return "Live-Build konnte nicht geprüft werden.";
  }

  if (!input.githubSha) {
    if (!input.github.configured) {
      return "GitHub-Token fehlt — Live-Commit bekannt, Vergleich mit main nicht möglich.";
    }
    if (!input.github.reachable) {
      return (
        input.github.message ??
        "GitHub-API nicht erreichbar — Live-Commit bekannt, Vergleich mit main nicht möglich."
      );
    }
    return "GitHub-Commit konnte nicht abgerufen werden — Live-Commit bekannt.";
  }

  return null;
}

export async function fetchLiveAppDeployStatus(
  github: SuperadminGithubRepoStatus,
): Promise<SuperadminLiveAppDeployStatus> {
  const siteUrl = getPublicSiteUrl() ?? null;
  const containerSha = normalizeSha(process.env.GWADA_BUILD_SHA);

  /**
   * Auf dem Live-Container ist GWADA_BUILD_SHA die Source of Truth.
   * Öffentlicher Self-Fetch (/api/build-info) kann per Hairpin/DNS scheitern
   * und fälschlich „unklar“ erzeugen.
   */
  const preferContainerSha =
    process.env.NODE_ENV === "production" && Boolean(containerSha);

  const remoteBuild = !preferContainerSha && siteUrl
    ? await fetchLiveBuildInfo(siteUrl)
    : null;

  const liveSha = preferContainerSha
    ? containerSha
    : (remoteBuild?.sha ?? containerSha);
  const liveShortSha = liveSha ? liveSha.slice(0, 7) : null;
  const liveReachable = preferContainerSha
    ? true
    : Boolean(remoteBuild?.reachable || liveSha);

  const githubSha = resolveGithubCompareSha(github);

  const syncState = deriveLiveAppSyncState({
    liveSha,
    githubSha,
    github,
  });

  const triggerConfigured =
    Boolean(githubDeployTokenStrict()) ||
    (github.configured && github.reachable);

  return {
    siteUrl,
    liveSha,
    liveShortSha,
    liveReachable,
    containerSha,
    syncState,
    message: buildMessage({
      syncState,
      liveReachable,
      liveSha,
      githubSha,
      github,
    }),
    triggerConfigured,
    deployLogHint: "/tmp/gwada-deploy-live-app.log (auf dem VPS)",
  };
}
