import "server-only";

import { createPrivateKey, createSign } from "node:crypto";
import { raceWithTimeout } from "@/lib/supabase/race-timeout";

const MINT_TIMEOUT_MS = 8_000;
/** Token ~1h gültig — 90s vor Ablauf neu holen. */
const REFRESH_SKEW_MS = 90_000;

type CachedInstallationToken = {
  token: string;
  expiresAtMs: number;
};

let cachedToken: CachedInstallationToken | null = null;

export type GithubAppCredentials = {
  appId: string;
  installationId: string;
  privateKey: string;
};

function envTrim(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

/** PEM aus Env: roh, mit \\n, oder Base64. */
export function normalizeGithubAppPrivateKey(raw: string): string | null {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  if (!key.includes("BEGIN") && /^[A-Za-z0-9+/=\s]+$/.test(key)) {
    try {
      const decoded = Buffer.from(key.replace(/\s+/g, ""), "base64").toString(
        "utf8",
      );
      if (decoded.includes("BEGIN")) key = decoded;
    } catch {
      /* ignore */
    }
  }

  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (!key.includes("BEGIN") || !key.includes("PRIVATE KEY")) return null;
  return key;
}

export function readGithubAppCredentials(): GithubAppCredentials | null {
  const appId = envTrim("GITHUB_APP_ID", "GWADA_GITHUB_APP_ID");
  const installationId = envTrim(
    "GITHUB_APP_INSTALLATION_ID",
    "GWADA_GITHUB_APP_INSTALLATION_ID",
  );
  const rawKey = envTrim(
    "GITHUB_APP_PRIVATE_KEY",
    "GWADA_GITHUB_APP_PRIVATE_KEY",
  );
  if (!appId || !installationId || !rawKey) return null;

  const privateKey = normalizeGithubAppPrivateKey(rawKey);
  if (!privateKey) return null;

  return { appId, installationId, privateKey };
}

export function githubAppCredentialsConfigured(): boolean {
  return readGithubAppCredentials() !== null;
}

function createGithubAppJwt(appId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      // GitHub verlangt iat nicht zu weit in der Zukunft; leichte Vergangenheit hilft bei Clock-Skew.
      iat: now - 60,
      exp: now + 8 * 60,
      iss: appId,
    }),
  ).toString("base64url");
  const data = `${header}.${payload}`;
  const key = createPrivateKey(privateKeyPem);
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  return `${data}.${signer.sign(key).toString("base64url")}`;
}

/**
 * Kurzlebigen Installation-Access-Token minten (automatisch, ~1h).
 * Private Key der GitHub App läuft nicht ab — kein manuelles PAT-Rotieren.
 */
export async function mintGithubAppInstallationToken(): Promise<string | null> {
  const creds = readGithubAppCredentials();
  if (!creds) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + REFRESH_SKEW_MS) {
    return cachedToken.token;
  }

  try {
    const jwt = createGithubAppJwt(creds.appId, creds.privateKey);
    const res = await raceWithTimeout(
      fetch(
        `https://api.github.com/app/installations/${encodeURIComponent(creds.installationId)}/access_tokens`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${jwt}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
          cache: "no-store",
        },
      ),
      MINT_TIMEOUT_MS,
      "GitHub-App-Token",
    );

    if (!res.ok) {
      cachedToken = null;
      const detail = (await res.text().catch(() => "")).slice(0, 400);
      console.error(
        `[github-app] installation token mint failed: HTTP ${res.status}`,
        detail,
        `appId=${creds.appId} installationId=${creds.installationId}`,
      );
      return null;
    }

    const body = (await res.json()) as {
      token?: string;
      expires_at?: string;
    };
    const token = body.token?.trim();
    if (!token) {
      cachedToken = null;
      return null;
    }

    const expiresAtMs = body.expires_at
      ? Date.parse(body.expires_at)
      : now + 55 * 60_000;
    cachedToken = {
      token,
      expiresAtMs: Number.isFinite(expiresAtMs)
        ? expiresAtMs
        : now + 55 * 60_000,
    };
    return token;
  } catch (e) {
    cachedToken = null;
    console.error(
      "[github-app] installation token mint error:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** Tests / Deploy-Hooks: Cache leeren. */
export function clearGithubAppInstallationTokenCache(): void {
  cachedToken = null;
}
