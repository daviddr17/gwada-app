export type SuperadminIntegrationConnectionState =
  | "disabled"
  | "not_configured"
  | "ok"
  | "error";

export type SuperadminIntegrationConnectionHealth = {
  state: SuperadminIntegrationConnectionState;
  message?: string;
  latencyMs?: number;
};

export type SuperadminGithubDeployWorkflowRun = {
  id: number;
  status: string | null;
  conclusion: string | null;
  htmlUrl: string | null;
  headSha: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  event: string | null;
};

export type SuperadminGithubDeployWorkflowStatus = {
  configured: boolean;
  reachable: boolean;
  workflowFile: string;
  label: string;
  latestRun: SuperadminGithubDeployWorkflowRun | null;
  activeRun: SuperadminGithubDeployWorkflowRun | null;
  message: string | null;
};

export type SuperadminGithubBranchInfo = {
  name: string;
  shortSha: string;
  isDefault: boolean;
  protected: boolean;
};

export type SuperadminGithubHeadCommit = {
  sha: string | null;
  shortSha: string | null;
  message: string | null;
  author: string | null;
  committedAt: string | null;
  htmlUrl: string | null;
};

export type SuperadminGithubRepoStatus = {
  configured: boolean;
  reachable: boolean;
  slug: string;
  htmlUrl: string;
  defaultBranch: string;
  deployBranch: string;
  description: string | null;
  pushedAt: string | null;
  branches: SuperadminGithubBranchInfo[];
  headCommit: SuperadminGithubHeadCommit;
  appDeployWorkflow: SuperadminGithubDeployWorkflowStatus;
  dbDeployWorkflow: SuperadminGithubDeployWorkflowStatus;
  message: string | null;
};

export type SuperadminLiveAppDeploySyncState =
  | "in_sync"
  | "out_of_sync"
  | "deploying"
  | "unknown";

export type SuperadminLiveAppDeployStatus = {
  siteUrl: string | null;
  liveSha: string | null;
  liveShortSha: string | null;
  liveReachable: boolean;
  containerSha: string | null;
  syncState: SuperadminLiveAppDeploySyncState;
  message: string | null;
  triggerConfigured: boolean;
  deployLogHint: string;
};

export type SuperadminVpsInfo = {
  provider: "Contabo";
  publicHost: string | null;
  sshUser: string;
  siteUrl: string | null;
  plannedProductionUrl: string | null;
  deploymentPhase: "development" | "staging" | "production";
  runtime: "production" | "development";
  workspaceSlug: string | null;
};

export type SuperadminDatabaseDetails = {
  publicUrl: string | null;
  proxyEnabled: boolean;
  upstreamConfigured: boolean;
  upstreamHost: string | null;
  studioUrl: string | null;
  studioAccessNote: string | null;
  serviceRoleConfigured: boolean;
  supabaseOnlyMode: boolean;
  migrationFilesCount: number | null;
};

export type SuperadminRepositoryGuideEntry = {
  path: string;
  description: string;
};

export type SuperadminRepositoryGuide = {
  repoSlug: string;
  repoUrl: string;
  defaultBranch: string;
  tree: SuperadminRepositoryGuideEntry[];
  docLinks: { label: string; path: string }[];
};

/** Coolify: nur noch Infrastruktur/Hosting — kein App-Deploy mehr */
export type SuperadminCoolifyInfo = {
  hostingDetected: boolean;
  supabaseDockerStack: boolean;
  dashboardUrl: string | null;
};

export type SuperadminDatabaseStatus = {
  ok: boolean;
  checkedAt: string;
  /** Minimal-Ping: eine Zeile aus `restaurants` */
  latencyMs: number | null;
  /** Parallel: exact count über drei Tabellen */
  countsLatencyMs: number | null;
  /** Gesamtdauer des Server-Status-Checks inkl. Counts */
  totalCheckLatencyMs: number | null;
  message?: string;
  database: SuperadminDatabaseDetails;
  vps: SuperadminVpsInfo;
  github: SuperadminGithubRepoStatus;
  liveApp: SuperadminLiveAppDeployStatus;
  coolify: SuperadminCoolifyInfo;
  repository: SuperadminRepositoryGuide;
  counts: {
    restaurants: number | null;
    profiles: number | null;
    platformSuperadmins: number | null;
  };
};
