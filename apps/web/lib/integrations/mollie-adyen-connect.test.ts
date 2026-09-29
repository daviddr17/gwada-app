import assert from "node:assert/strict";
import { test } from "node:test";
import { adyenOnboardingRedirectUrl } from "./adyen-connect";
import {
  adyenConfigToUi,
  mergeAdyenPlatformConfig,
} from "./platform-adyen-config";
import {
  buildMollieAuthorizeUrl,
  publicMollieConnection,
} from "./mollie-connect";
import {
  mergeMolliePlatformConfig,
  mollieConfigToUi,
} from "./platform-mollie-config";

test("Mollie authorize URL stays on Mollie and omits the client secret", () => {
  const url = new URL(
    buildMollieAuthorizeUrl({
      clientId: "app_client",
      redirectUri: "https://gwada.app/api/integrations/mollie/callback",
      state: "state",
    }),
  );
  assert.equal(url.origin, "https://my.mollie.com");
  assert.equal(url.pathname, "/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "app_client");
  assert.equal(url.searchParams.get("client_secret"), null);
  assert.match(url.searchParams.get("scope") ?? "", /payments\.write/);
  assert.doesNotMatch(url.searchParams.get("scope") ?? "", /application.?fee/i);
});

test("Mollie status for the restaurant omits tokens and account ids", () => {
  const token = "access_live_secret_value";
  const pub = publicMollieConnection({
    status: "connected",
    organization_name: "Zur Schlagd",
    organization_id: "org_hidden",
    profile_id: "pfl_hidden",
    access_token: token,
    refresh_token: "refresh_hidden",
    connected_at: "2026-09-29T12:00:00.000Z",
  });
  const json = JSON.stringify(pub);
  assert.equal(json.includes(token), false);
  assert.equal(json.includes("org_hidden"), false);
  assert.equal(json.includes("refresh_hidden"), false);
  assert.equal(pub.displayName, "Zur Schlagd");
  assert.equal(pub.status, "connected");
});

test("blank Mollie secret fields keep the saved platform credentials", () => {
  const merged = mergeMolliePlatformConfig(
    { client_id: "kept-id", client_secret: "kept-secret" },
    {},
  );
  assert.equal(merged.client_id, "kept-id");
  assert.equal(merged.client_secret, "kept-secret");
  const ui = mollieConfigToUi({
    client_id: "kept-id",
    client_secret: "kept-secret",
  });
  assert.deepEqual(ui, {
    client_id_configured: true,
    client_secret_configured: true,
  });
  assert.equal(JSON.stringify(ui).includes("kept-secret"), false);
  assert.equal(JSON.stringify(ui).includes("kept-id"), false);
});

test("Adyen onboarding redirect accepts only an https Adyen host", () => {
  assert.equal(
    adyenOnboardingRedirectUrl({
      url: "https://balanceplatform-test.adyen.com/balanceplatform/uo/session",
    }),
    "https://balanceplatform-test.adyen.com/balanceplatform/uo/session",
  );
  assert.equal(
    adyenOnboardingRedirectUrl({ url: "https://my.mollie.com/oauth2/authorize" }),
    null,
  );
  assert.equal(
    adyenOnboardingRedirectUrl({ url: "http://balanceplatform-test.adyen.com/uo" }),
    null,
  );
});

test("blank Adyen key fields keep the saved platform keys out of the UI", () => {
  const merged = mergeAdyenPlatformConfig(
    { lem_api_key: "lem-kept", balance_platform_api_key: "bcl-kept", env: "test" },
    { env: "test" },
  );
  assert.equal(merged.lem_api_key, "lem-kept");
  assert.equal(merged.balance_platform_api_key, "bcl-kept");
  const ui = adyenConfigToUi({
    env: "test",
    lem_api_key: "lem-kept",
    balance_platform_api_key: "bcl-kept",
  });
  const json = JSON.stringify(ui);
  assert.equal(json.includes("lem-kept"), false);
  assert.equal(json.includes("bcl-kept"), false);
  assert.equal(ui.lem_api_key_configured, true);
  assert.equal(ui.balance_platform_api_key_configured, true);
});
