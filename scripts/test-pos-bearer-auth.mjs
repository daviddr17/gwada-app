#!/usr/bin/env node
/**
 * Local smoke test: sign in → validate token → hit POS /orders/active.
 * Usage: node scripts/test-pos-bearer-auth.mjs
 */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { loadEnvConfig } = nextEnv;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(ROOT);
loadEnvConfig(resolve(ROOT, "apps/web"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiBase = process.env.GWADA_TEST_API_URL ?? "http://127.0.0.1:3000";
const restaurantId =
  process.env.GWADA_TEST_RESTAURANT_ID ??
  "4725e630-ebd1-4679-835e-fd8982fd5960";
const email = process.env.GWADA_TEST_EMAIL ?? "dreyer@techlion.de";
const password = process.env.GWADA_TEST_PASSWORD ?? "GwadaLocal2026!";

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_* in .env.local — run pnpm env:sync:local");
  process.exit(1);
}

const client = createClient(url, anon);
const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
  email,
  password,
});
if (signInError || !signIn.session?.access_token) {
  console.error("signIn failed:", signInError?.message ?? "no session");
  process.exit(1);
}

const token = signIn.session.access_token;
console.log("signIn ok, token length:", token.length);

const userRes = await fetch(`${url}/auth/v1/user`, {
  headers: { Authorization: `Bearer ${token}`, apikey: anon },
});
console.log("auth/v1/user (publishable apikey):", userRes.status);

if (service) {
  const admin = createClient(url, service, {
    auth: { persistSession: false },
  });
  const adminUser = await admin.auth.getUser(token);
  console.log("admin.auth.getUser:", adminUser.error?.message ?? "ok");
}

const posRes = await fetch(
  `${apiBase}/api/pos/orders/active?restaurantId=${restaurantId}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const posBody = await posRes.text();
console.log("POS /orders/active:", posRes.status, posBody.slice(0, 120));
