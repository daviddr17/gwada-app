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

export type SuperadminCoolifyDeploymentInfo = {
  /** Coolify-Env oder typisches VPS-Proxy-Setup erkannt */
  detected: boolean;
  runtime: "production" | "development";
  /** staging = new.gwada.app o. Ä.; production = finale Kunden-Domain */
  deploymentPhase: "development" | "staging" | "production";
  appUrl: string | null;
  plannedProductionUrl: string | null;
  supabasePublicUrl: string | null;
  supabaseUpstream: string | null;
  supabaseStudioHint: string | null;
  /** z. B. SSH-Tunnel-Hinweis, wenn Studio nicht öffentlich erreichbar ist */
  supabaseStudioAccessNote: string | null;
  dashboardUrl: string | null;
  deployBranch: string | null;
  sourceCommit: string | null;
  proxyEnabled: boolean;
  applicationUuid: string | null;
  liveDeploy: SuperadminCoolifyLiveDeployStatus;
};

export type SuperadminCoolifyActiveDeployment = {
  status: string;
  commit: string | null;
  startedAt: string | null;
  deploymentUuid: string | null;
  deploymentUiPath: string | null;
};

export type SuperadminCoolifyLastDeploy = {
  /** ISO-Zeitstempel des letzten abgeschlossenen Coolify-Deploys */
  finishedAt: string | null;
  commit: string | null;
  status: string | null;
};

export type SuperadminCoolifyLiveDeployStatus = {
  apiConfigured: boolean;
  apiReachable: boolean;
  applicationUuid: string | null;
  appRuntimeStatus: string | null;
  active: SuperadminCoolifyActiveDeployment[];
  lastDeploy: SuperadminCoolifyLastDeploy;
  summary: "idle" | "deploying" | "queued" | "unavailable";
  message: string | null;
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
  api: {
    publicUrl: string | null;
    proxyEnabled: boolean;
    siteUrl: string | null;
    workspaceSlug: string | null;
  };
  server: {
    serviceRoleConfigured: boolean;
    supabaseUpstreamConfigured: boolean;
    supabaseOnlyMode: boolean;
  };
  coolify: SuperadminCoolifyDeploymentInfo;
  counts: {
    restaurants: number | null;
    profiles: number | null;
    platformSuperadmins: number | null;
  };
};
