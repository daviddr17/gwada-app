/**
 * Upload Messe-Demo-Bilder für Die Salzkante (Live).
 * Nutzt nur Node fetch — keine Extra-Deps.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (oder SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ASSETS = join(ROOT, "scripts/messe-demo-assets");

const RID = "a55c0001-5a17-4a17-8a17-c00000000001";
const PROFILE_BUCKET = "restaurant-profile-images";
const NEWS_BUCKET = "news-media";

const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!base || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY nötig.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  apikey: key,
};

function load(name) {
  const p = join(ASSETS, name);
  if (!existsSync(p)) throw new Error(`Asset fehlt: ${p}`);
  return readFileSync(p);
}

async function upload(bucket, path, bytes, contentType = "image/jpeg") {
  const url = `${base}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${bucket}/${path}: HTTP ${res.status} ${text}`);
  }
  console.log(`✓ ${bucket}/${path}`);
}

async function signedUrl(bucket, path, expiresIn = 60 * 60 * 24 * 365 * 5) {
  const url = `${base}/storage/v1/object/sign/${bucket}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  const json = await res.json();
  if (!res.ok || !json?.signedURL) {
    throw new Error(
      `signedUrl ${bucket}/${path}: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const signed = String(json.signedURL);
  return signed.startsWith("http") ? signed : `${base}/storage/v1${signed}`;
}

async function patch(table, match, body) {
  const qs = new URLSearchParams(match).toString();
  const res = await fetch(`${base}/rest/v1/${table}?${qs}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${table}: HTTP ${res.status} ${text}`);
  }
}

const dishMap = [
  {
    file: "salzkante-dish-gerauchte-makrele.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000090",
    path: `${RID}/menu/gerauchte-makrele.jpg`,
  },
  {
    file: "salzkante-dish-nordseegarnelen.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000091",
    path: `${RID}/menu/nordseegarnelen.jpg`,
  },
  {
    file: "salzkante-dish-matjes.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000092",
    path: `${RID}/menu/matjes.jpg`,
  },
  {
    file: "salzkante-dish-fischsuppe.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000093",
    path: `${RID}/menu/fischsuppe.jpg`,
  },
  {
    file: "salzkante-dish-scholle.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000094",
    path: `${RID}/menu/scholle.jpg`,
  },
  {
    file: "salzkante-dish-holstein-rind.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000095",
    path: `${RID}/menu/holstein-rind.jpg`,
  },
  {
    file: "salzkante-dish-sellerie.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000096",
    path: `${RID}/menu/sellerie.jpg`,
  },
  {
    file: "salzkante-dish-rote-bete.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000097",
    path: `${RID}/menu/rote-bete.jpg`,
  },
  {
    file: "salzkante-dish-sanddorn.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000098",
    path: `${RID}/menu/sanddorn.jpg`,
  },
  {
    file: "salzkante-dish-bier-aquavit.jpg",
    itemId: "a55c0001-5a17-4a17-8a17-c00000000099",
    path: `${RID}/menu/bier-aquavit.jpg`,
  },
];

const newsMap = [
  { file: "salzkante-cover.jpg", path: `${RID}/news/raucherkammer.jpg` },
  { file: "salzkante-dish-scholle.jpg", path: `${RID}/news/sonntag.jpg` },
  { file: "salzkante-dish-bier-aquavit.jpg", path: `${RID}/news/pairing.jpg` },
];

async function main() {
  await upload(PROFILE_BUCKET, `${RID}/avatar.jpg`, load("salzkante-logo.jpg"));
  await upload(PROFILE_BUCKET, `${RID}/cover.jpg`, load("salzkante-cover.jpg"));

  for (const n of newsMap) {
    await upload(NEWS_BUCKET, n.path, load(n.file));
  }

  for (const d of dishMap) {
    await upload(PROFILE_BUCKET, d.path, load(d.file));
    const imageUrl = await signedUrl(PROFILE_BUCKET, d.path);
    await patch(
      "menu_items",
      { id: `eq.${d.itemId}`, restaurant_id: `eq.${RID}` },
      { image_url: imageUrl },
    );
    console.log(`✓ menu image_url → ${d.itemId}`);
  }

  for (const e of [
    {
      itemId: "a55c0001-5a17-4a17-8a17-c0000000009a",
      path: `${RID}/menu/bier-aquavit.jpg`,
    },
    {
      itemId: "a55c0001-5a17-4a17-8a17-c0000000009b",
      path: `${RID}/menu/rote-bete.jpg`,
    },
  ]) {
    const imageUrl = await signedUrl(PROFILE_BUCKET, e.path);
    await patch(
      "menu_items",
      { id: `eq.${e.itemId}`, restaurant_id: `eq.${RID}` },
      { image_url: imageUrl },
    );
    console.log(`✓ menu image_url → ${e.itemId}`);
  }

  await patch(
    "restaurants",
    { id: `eq.${RID}` },
    {
      avatar_storage_path: `${RID}/avatar.jpg`,
      cover_storage_path: `${RID}/cover.jpg`,
      brand_accent_hex: "#0B4F6C",
    },
  );

  console.log("Media-Upload fertig: Die Salzkante");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
