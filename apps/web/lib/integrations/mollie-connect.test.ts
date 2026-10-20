import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMollieAuthorizeUrl,
  MOLLIE_CONNECT_SCOPES,
  publicMollieConnection,
} from "./mollie-connect.ts";

test("builds authorize url with required scopes", () => {
  const url = buildMollieAuthorizeUrl({
    clientId: "app_x",
    redirectUri: "https://gwada.app/api/integrations/mollie/callback",
    state: "abc",
  });
  assert.match(url, /client_id=app_x/);
  assert.match(url, /response_type=code/);
  const decoded = decodeURIComponent(url);
  for (const scope of MOLLIE_CONNECT_SCOPES) {
    assert.ok(decoded.includes(scope), scope);
  }
});

test("hides tokens in public status", () => {
  const pub = publicMollieConnection({
    status: "connected",
    organization_name: "Zur Schlagd",
    organization_id: "org_x",
    profile_id: "pfl_x",
    access_token: "access_hidden",
    refresh_token: "refresh_hidden",
    connected_at: "2026-01-01T00:00:00.000Z",
  });
  assert.deepEqual(pub, {
    status: "connected",
    displayName: "Zur Schlagd",
    connectedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(JSON.stringify(pub).includes("access_hidden"), false);
});
