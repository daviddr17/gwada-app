import "server-only";

import { getPublicSiteUrl } from "@/lib/public-env";
import {
  fetchGithubDeployWorkflowStatus,
  fetchGithubMainCommitSha,
  type GithubDeployApiStatus,
} from "@/lib/superadmin/github-deploy-api-server";
import type { SuperadminLiveAppDeployStatus } from "@/lib/types/superadmin-ops-status";
import { raceWithTimeout } from "@/lib/supabase/race-timeout";

const BUILD_INFO_TIMEOUT_MS = 6_000;

function normalizeSha(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed || trimmed === "dev") return null;
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
      shortSha: normalized ? normalized.slice(0, 7) : raw,
      reachable: true,
      message: null,
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

function deriveSyncState(input: {
  liveSha: string | null;
  githubSha: string | null;
  githubWorkflow: GithubDeployApiStatus;
  coolifySummary: "idle" | "deploying" | "queued" | "unavailable";
}): SuperadminLiveAppDeployStatus["syncState"] {
  const githubActive = Boolean(input.githubWorkflow.activeRun);
  const coolifyActive =
    input.coolifySummary === "deploying" || input.coolifySummary === "queued";

  if (githubActive || coolifyActive) return "deploying";

  if (input.liveSha && input.githubSha) {
    return shasMatch(input.liveSha, input.githubSha) ? "in_sync" : "out_of_sync";
  }

  return "unknown";
}

function buildMessage(input: {
  syncState: SuperadminLiveAppDeployStatus["syncState"];
  liveReachable: boolean;
  githubReachable: boolean;
  githubWorkflow: GithubDeployApiStatus;
}): string | null {
  if (input.syncState === "in_sync") {
    return "Live-App entspricht dem neuesten main-Commit auf GitHub.";
  }

  if (input.syncState === "deploying") {
    if (input.githubWorkflow.activeRun) {
      return "GitHub Actions baut und deployt gerade auf den VPS.";
    }
    return "Deploy läuft — Live-Commit wird gleich aktualisiert.";
  }

  if (input.syncState === "out_of_sync") {
    return "Live-App ist veraltet: öffentliche URL liefert einen älteren Build als GitHub main. Deploy starten oder GitHub Secrets prüfen.";
  }

  if (!input.liveReachable) {
    return "Live-Build konnte nicht geprüft werden.";
  }

  if (!input.githubReachable) {
    return "GitHub main-Commit konnte nicht abgerufen werden.";
  }

  return null;
}

export async function fetchLiveAppDeployStatus(
  coolifySummary: "idle" | "deploying" | "queued" | "unavailable",
): Promise<SuperadminLiveAppDeployStatus> {
  const siteUrl = getPublicSiteUrl() ?? null;
  const containerSha = normalizeSha(process.env.GWADA_BUILD_SHA);

  const [liveBuild, githubMain, githubWorkflow] = await Promise.all([
    siteUrl
      ? fetchLiveBuildInfo(siteUrl)
      : Promise.resolve({
          sha: null,
          shortSha: null,
          reachable: false,
          message: "NEXT_PUBLIC_SITE_URL fehlt.",
        }),
    fetchGithubMainCommitSha(),
    fetchGithubDeployWorkflowStatus(),
  ]);

  const syncState = deriveSyncState({
    liveSha: liveBuild.sha,
    githubSha: githubMain.sha,
    githubWorkflow,
    coolifySummary,
  });

  const triggerConfigured = githubWorkflow.configured;

  return {
    siteUrl,
    liveSha: liveBuild.sha,
    liveShortSha: liveBuild.shortSha,
    liveReachable: liveBuild.reachable,
    containerSha,
    githubSha: githubMain.sha,
    githubShortSha: githubMain.shortSha,
    githubCommitMessage: githubMain.message,
    githubReachable: githubMain.reachable,
    syncState,
    message: buildMessage({
      syncState,
      liveReachable: liveBuild.reachable,
      githubReachable: githubMain.reachable,
      githubWorkflow,
    }),
    githubWorkflow,
    triggerConfigured,
    deployLogHint: "/tmp/gwada-deploy-live-app.log (auf dem VPS)",
  };
}
