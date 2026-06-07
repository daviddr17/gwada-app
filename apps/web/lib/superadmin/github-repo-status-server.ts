import "server-only";

import {
  APP_DEPLOY_WORKFLOW_FILE,
  DB_DEPLOY_WORKFLOW_FILE,
  fetchGithubBranches,
  fetchGithubDeployWorkflowStatus,
  fetchGithubHeadCommit,
  githubDeployBranch,
  githubDeployToken,
  githubRepoSlug,
} from "@/lib/superadmin/github-deploy-api-server";
import { buildRepositoryGuide } from "@/lib/superadmin/repository-guide";
import type { SuperadminGithubRepoStatus } from "@/lib/types/superadmin-ops-status";

export async function fetchSuperadminGithubRepoStatus(): Promise<SuperadminGithubRepoStatus> {
  const slug = githubRepoSlug();
  const deployBranch = githubDeployBranch();
  const configured = Boolean(githubDeployToken());
  const htmlUrl = `https://github.com/${slug}`;

  const [branches, headCommit, appDeployWorkflow, dbDeployWorkflow] =
    await Promise.all([
      fetchGithubBranches(),
      fetchGithubHeadCommit(deployBranch),
      fetchGithubDeployWorkflowStatus({
        workflowFile: APP_DEPLOY_WORKFLOW_FILE,
        label: "App live",
      }),
      fetchGithubDeployWorkflowStatus({
        workflowFile: DB_DEPLOY_WORKFLOW_FILE,
        label: "DB live",
      }),
    ]);

  const reachable =
    branches.reachable ||
    headCommit.reachable ||
    appDeployWorkflow.reachable ||
    dbDeployWorkflow.reachable;

  const message =
    branches.message ??
    appDeployWorkflow.message ??
    dbDeployWorkflow.message ??
    null;

  return {
    configured,
    reachable,
    slug,
    htmlUrl,
    defaultBranch: branches.defaultBranch,
    deployBranch,
    description: branches.description,
    pushedAt: branches.pushedAt,
    branches: branches.branches,
    headCommit: {
      sha: headCommit.sha,
      shortSha: headCommit.shortSha,
      message: headCommit.message,
      author: headCommit.author,
      committedAt: headCommit.committedAt,
      htmlUrl: headCommit.htmlUrl,
    },
    appDeployWorkflow,
    dbDeployWorkflow,
    message,
  };
}

export function buildSuperadminRepositoryGuide(defaultBranch: string) {
  return buildRepositoryGuide({
    repoSlug: githubRepoSlug(),
    defaultBranch,
  });
}
