#!/usr/bin/env node
/**
 * Expo CI-Token: anlegen, als GitHub-Secret speichern, EAS-Production-Env syncen.
 *
 * Variante A — Token direkt:
 *   EXPO_TOKEN=… node scripts/provision-expo-ci-token.mjs
 *
 * Variante B — Login + Token erzeugen:
 *   EXPO_USERNAME=… EXPO_PASSWORD=… node scripts/provision-expo-ci-token.mjs
 *
 * Variante C — nur gh secret + Workflow (Token aus stdin):
 *   echo "$EXPO_TOKEN" | node scripts/provision-expo-ci-token.mjs --from-stdin
 */
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";

const NOTE = "gwada-app CI (sync-staff-eas-env-live)";
const API = "https://api.expo.dev/v2";
const GRAPHQL = "https://api.expo.dev/graphql";

async function loginAsync(username, password, otp) {
  const body = { username, password };
  if (otp) body.otp = otp;
  const res = await fetch(`${API}/auth/loginAsync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.sessionSecret) {
    const msg =
      json?.errors?.[0]?.message ??
      json?.errors?.[0]?.code ??
      `HTTP ${res.status}`;
    throw new Error(`Expo-Login fehlgeschlagen: ${msg}`);
  }
  return json.data.sessionSecret;
}

async function graphql(sessionSecret, query, variables) {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "expo-session": sessionSecret,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}

async function createAccessToken(sessionSecret) {
  const me = await graphql(
    sessionSecret,
    `query { meUserActor { id username } }`,
  );
  const actorId = me?.meUserActor?.id;
  const username = me?.meUserActor?.username;
  if (!actorId) throw new Error("Expo-Session: meUserActor fehlt");

  const created = await graphql(
    sessionSecret,
    `mutation($input: CreateAccessTokenInput!) {
      accessToken {
        createAccessToken(createAccessTokenData: $input) {
          token
        }
      }
    }`,
    { input: { actorID: actorId, note: NOTE } },
  );
  const token = created?.accessToken?.createAccessToken?.token;
  if (!token) throw new Error("createAccessToken: kein Token in Antwort");
  console.log(`✓ Expo Access Token für @${username}`);
  return token;
}

async function readStdinToken() {
  const rl = createInterface({ input: process.stdin });
  let token = "";
  for await (const line of rl) token += line;
  token = token.trim();
  if (!token) throw new Error("Kein Token auf stdin");
  return token;
}

function setGhSecret(token) {
  execSync("gh secret set EXPO_TOKEN --body -", {
    input: token,
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log("✓ GitHub Secret EXPO_TOKEN gesetzt");
}

function runEasSyncWorkflow() {
  execSync("gh workflow run sync-staff-eas-env-live.yml --ref main", {
    stdio: "inherit",
  });
  console.log("→ sync-staff-eas-env-live.yml gestartet");
  execSync(
    "gh run watch --workflow=sync-staff-eas-env-live.yml --exit-status",
    { stdio: "inherit" },
  );
  console.log("✓ EAS production-Environment synchronisiert");
}

async function resolveToken() {
  const fromEnv = process.env.EXPO_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  if (process.argv.includes("--from-stdin")) {
    return readStdinToken();
  }

  const username = process.env.EXPO_USERNAME?.trim();
  const password = process.env.EXPO_PASSWORD?.trim();
  if (username && password) {
    const otp = process.env.EXPO_OTP?.trim();
    const session = await loginAsync(username, password, otp);
    return createAccessToken(session);
  }

  throw new Error(
    "Kein EXPO_TOKEN. Entweder:\n" +
      "  EXPO_TOKEN=… node scripts/provision-expo-ci-token.mjs\n" +
      "  EXPO_USERNAME=… EXPO_PASSWORD=… node scripts/provision-expo-ci-token.mjs\n" +
      "  (Account atfadi17 nutzt meist GitHub — Token manuell von expo.dev → gh secret set EXPO_TOKEN)",
  );
}

async function main() {
  const token = await resolveToken();
  setGhSecret(token);
  runEasSyncWorkflow();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
