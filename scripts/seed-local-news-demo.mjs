#!/usr/bin/env node
/**
 * 8 Beispiel-News für lokales Restaurant (Gwada-Posts + Medien in news-media).
 * Usage: node scripts/seed-local-news-demo.mjs [restaurant-slug]
 * Default slug: zurschlagd
 */

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const SLUG = process.argv[2]?.trim() || "zurschlagd";
const BUCKET = "news-media";

const POST_IDS = [
  "a1000001-0001-4001-8001-000000000001",
  "a1000001-0001-4001-8001-000000000002",
  "a1000001-0001-4001-8001-000000000003",
  "a1000001-0001-4001-8001-000000000004",
  "a1000001-0001-4001-8001-000000000005",
  "a1000001-0001-4001-8001-000000000006",
  "a1000001-0001-4001-8001-000000000007",
  "a1000001-0001-4001-8001-000000000008",
];

const DEMO_POSTS = [
  {
    id: POST_IDS[0],
    title: "Frische Matjes-Saison",
    body: "Ab heute wieder Matjes „Hausfrauenart“ — mit Bratkartoffeln und Remoulade. Solange der Vorrat reicht!",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&q=80",
    daysAgo: 1,
  },
  {
    id: POST_IDS[1],
    title: "Live-Musik am Freitag",
    body: "Jazz & maritime Klänge auf der Terrasse — ab 19 Uhr. Reservierung empfohlen, besonders bei schönem Wetter. Wir freuen uns auf euch!",
    imageUrl: null,
    daysAgo: 2,
  },
  {
    id: POST_IDS[2],
    title: "Sonntagsbrunch",
    body: "Jeden Sonntag 10–14 Uhr: Brötchen, Lachs, Eierspeisen und Kaffee flat. Kinderportion halber Preis.",
    imageUrl: "https://picsum.photos/seed/gwada-brunch/900/600",
    daysAgo: 3,
  },
  {
    id: POST_IDS[3],
    title: null,
    body: "Die Terrasse ist wieder geöffnet — Sonne tanken mit Blick auf den Hafen. Heißgetränke und kleine Snacks ab 11 Uhr.",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80",
    daysAgo: 5,
  },
  {
    id: POST_IDS[4],
    title: "Neue Weinkarte",
    body: "12 neue Tropfen aus dem Mosel & der Pfalz — auch als Glaswein. Fragt unser Team nach Empfehlungen zum Fischgericht.",
    imageUrl:
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=900&q=80",
    daysAgo: 7,
  },
  {
    id: POST_IDS[5],
    title: "Wir suchen Verstärkung",
    body: "Servicekraft (m/w/d), Teilzeit — abends & Wochenende. Bewerbung per Mail oder kurz an der Theke vorbeischauen.",
    imageUrl: null,
    daysAgo: 10,
  },
  {
    id: POST_IDS[6],
    title: "Hafenfest-Wochenende",
    body: "Danke an alle Gäste und Nachbarn — das Fest war grandios! Fotos folgen, hier schon mal ein Eindruck vom Samstagabend.",
    imageUrl:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=900&q=80",
    daysAgo: 12,
  },
  {
    id: POST_IDS[7],
    title: "Tageskarte · 12. Juni",
    body: "Kabeljau in Senfsoße · gebratene Scholle · vegetarische Pasta mit Spargel. Suppe des Tages: Fischsuppe.",
    imageUrl:
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=900&q=80",
    daysAgo: 0,
  },
];

function supabaseLocalAdmin() {
  const raw = execSync("npx supabase status -o json", {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  const status = JSON.parse(raw);
  const url = status.API_URL;
  const key = status.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Local Supabase not running (supabase start)");
  return createClient(url, key, { auth: { persistSession: false } });
}

function publishedAt(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

async function uploadImage(admin, restaurantId, postId, imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`image_fetch_${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type")?.includes("png")
    ? "image/png"
    : "image/jpeg";
  const storagePath = `${restaurantId}/${postId}/demo_${Date.now()}.jpg`;
  const { error } = await admin.storage.from(BUCKET).upload(storagePath, buf, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return {
    id: `${postId}-media`,
    kind: "image",
    storagePath,
    mimeType: contentType,
    sortOrder: 0,
  };
}

async function main() {
  const admin = supabaseLocalAdmin();

  const { data: restaurant, error: rErr } = await admin
    .from("restaurants")
    .select("id, name, slug")
    .eq("slug", SLUG)
    .maybeSingle();

  if (rErr) throw new Error(rErr.message);
  if (!restaurant?.id) {
    throw new Error(`Restaurant slug "${SLUG}" not found locally`);
  }

  const restaurantId = restaurant.id;
  console.log(`Seeding 8 demo news for ${restaurant.name} (${restaurant.slug})…`);

  await admin.from("gwada_news_publications").delete().in("post_id", POST_IDS);
  await admin.from("gwada_news_posts").delete().in("id", POST_IDS);

  for (const demo of DEMO_POSTS) {
    let media = [];
    if (demo.imageUrl) {
      try {
        const row = await uploadImage(admin, restaurantId, demo.id, demo.imageUrl);
        media = [row];
      } catch (e) {
        console.warn(`  image skip ${demo.id}:`, e instanceof Error ? e.message : e);
      }
    }

    const pubAt = publishedAt(demo.daysAgo);
    const { error: postErr } = await admin.from("gwada_news_posts").insert({
      id: demo.id,
      restaurant_id: restaurantId,
      title: demo.title,
      body: demo.body,
      status: "published",
      published_at: pubAt,
      media,
    });
    if (postErr) throw new Error(postErr.message);

    const { error: pubErr } = await admin.from("gwada_news_publications").insert({
      post_id: demo.id,
      restaurant_id: restaurantId,
      platform: "gwada",
      status: "published",
      published_at: pubAt,
    });
    if (pubErr) throw new Error(pubErr.message);

    console.log(`  ✓ ${demo.title ?? demo.body.slice(0, 40)}…`);
  }

  console.log("Done — News → Übersicht im Dashboard öffnen.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
