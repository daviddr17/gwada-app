#!/usr/bin/env node
/**
 * Bubble → Supabase: Mitarbeiterzeiten für einen Kalendertag (Europe/Berlin).
 *
 * Usage:
 *   BUBBLE_API_TOKEN=… dotenv -e .env.production -- node scripts/migrate-bubble-staff-times-day.mjs 2026-07-04
 *   … --dry-run
 *
 * Env: BUBBLE_API_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: GWADA_LEGACY_BUBBLE_URL (default https://old.gwada.app)
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const DATE_ARG = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
if (!DATE_ARG) {
  console.error("Usage: node scripts/migrate-bubble-staff-times-day.mjs YYYY-MM-DD [--dry-run]");
  process.exit(1);
}

const BUBBLE_TOKEN = process.env.BUBBLE_API_TOKEN?.trim();
const RESTAURANT_SLUG = "zurschlagd";
const BUBBLE_RESTAURANT_ID = "1612048001800x290697041559945200";
const BUBBLE_BASE = `${(process.env.GWADA_LEGACY_BUBBLE_URL ?? "https://old.gwada.app").replace(/\/$/, "")}/api/1.1/obj`;

const TIME_TYPE_MAP = {
  Arbeitszeit: "work",
  Pause: "break",
  Urlaubstag: "vacation",
  Request: "other",
};

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Env ${name} fehlt`);
  return v;
}

/** Kalendertag Europe/Berlin → UTC-Grenzen. */
function berlinDayBounds(dateYmd) {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  function berlinToUtc(berlinParts) {
    const guess = Date.UTC(
      berlinParts.year,
      berlinParts.month - 1,
      berlinParts.day,
      berlinParts.hour,
      berlinParts.minute,
      berlinParts.second,
    );
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
    );
    const shown = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return new Date(guess + (guess - shown));
  }
  const start = berlinToUtc({ year: y, month: m, day: d, hour: 0, minute: 0, second: 0 });
  const end = berlinToUtc({ year: y, month: m, day: d, hour: 23, minute: 59, second: 59 });
  return { start, end };
}

function normIso(iso) {
  return new Date(iso).toISOString();
}

function normName(given, family) {
  return `${String(given ?? "").trim().toLowerCase()}|${String(family ?? "").trim().toLowerCase()}`;
}

async function bubbleFetchAll(type, constraints) {
  const rows = [];
  let cursor = 0;
  const cParam = constraints
    ? `&constraints=${encodeURIComponent(JSON.stringify(constraints))}`
    : "";
  while (true) {
    const url = `${BUBBLE_BASE}/${type}?limit=100&cursor=${cursor}${cParam}`;
    let data;
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` },
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1_500 * 2 ** attempt)));
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Bubble ${type} HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      data = await res.json();
      break;
    }
    if (!data) throw new Error(`Bubble ${type}: Rate-Limit nach Retries`);
    const batch = data?.response?.results ?? [];
    rows.push(...batch);
    if (!data?.response?.remaining) break;
    cursor += 100;
    await new Promise((r) => setTimeout(r, 120));
  }
  return rows;
}

async function main() {
  if (!BUBBLE_TOKEN) throw new Error("BUBBLE_API_TOKEN fehlt");

  const { start: dayStart, end: dayEnd } = berlinDayBounds(DATE_ARG);
  const admin = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(DRY_RUN ? "=== DRY-RUN ===" : "=== IMPORT ===");
  console.log(`Tag: ${DATE_ARG} (Berlin) → ${dayStart.toISOString()} … ${dayEnd.toISOString()}`);
  console.log(`Bubble: ${BUBBLE_BASE}`);

  const { data: restaurant, error: restErr } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", RESTAURANT_SLUG)
    .single();
  if (restErr || !restaurant) throw new Error(`Restaurant ${RESTAURANT_SLUG}: ${restErr?.message ?? "nicht gefunden"}`);

  const restaurantConstraint = [
    { key: "Restaurant", constraint_type: "equals", value: BUBBLE_RESTAURANT_ID },
  ];

  console.log("Bubble laden: employee, employeetime, employeetimetype …");
  const [employees, employeeTimes, timeTypes] = await Promise.all([
    bubbleFetchAll("employee", restaurantConstraint),
    bubbleFetchAll("employeetime", restaurantConstraint),
    bubbleFetchAll("employeetimetype", null),
  ]);

  const { data: staffRows, error: staffErr } = await admin
    .from("restaurant_staff")
    .select("id, given_name, family_name, email")
    .eq("restaurant_id", restaurant.id);
  if (staffErr) throw new Error(staffErr.message);

  const { data: existingRows, error: existErr } = await admin
    .from("restaurant_staff_work_entries")
    .select("staff_id, starts_at, ends_at")
    .eq("restaurant_id", restaurant.id)
    .gte("starts_at", dayStart.toISOString())
    .lte("starts_at", dayEnd.toISOString());
  if (existErr) throw new Error(existErr.message);

  const timeTypeById = new Map(timeTypes.map((t) => [t._id, t.Name]));
  const empById = new Map(employees.map((e) => [e._id, e]));
  const staffByEmail = new Map();
  const staffByName = new Map();
  for (const s of staffRows ?? []) {
    if (s.email) staffByEmail.set(s.email.trim().toLowerCase(), s.id);
    staffByName.set(normName(s.given_name, s.family_name), s.id);
  }

  const existingKeys = new Set(
    (existingRows ?? []).map((e) => `${e.staff_id}|${normIso(e.starts_at)}|${normIso(e.ends_at)}`),
  );

  const onDay = employeeTimes.filter((t) => {
    const startsAt = t.Start ?? t.Range?.[0];
    if (!startsAt) return false;
    const s = new Date(startsAt);
    return s >= dayStart && s <= dayEnd;
  });

  const workRows = [];
  const skipped = { unmapped: 0, duplicate: 0, invalid: 0 };

  for (const t of onDay) {
    const emp = empById.get(t.Employee);
    if (!emp) {
      skipped.unmapped += 1;
      continue;
    }
    const email = emp.Email?.trim().toLowerCase();
    const staffId =
      (email && staffByEmail.get(email)) ||
      staffByName.get(normName(emp.FirstName, emp.LastName));
    if (!staffId) {
      console.warn(`  ⚠ Kein Staff-Match: ${emp.FirstName} ${emp.LastName}`);
      skipped.unmapped += 1;
      continue;
    }

    const typeName = timeTypeById.get(t.Type) ?? "Arbeitszeit";
    const entryType = TIME_TYPE_MAP[typeName] ?? "other";
    const startsAt = t.Start ?? t.Range?.[0];
    const endsAt = t.End ?? t.Range?.[1];
    if (!startsAt || !endsAt) {
      skipped.invalid += 1;
      continue;
    }
    if (new Date(endsAt) < new Date(startsAt)) {
      skipped.invalid += 1;
      continue;
    }

    const key = `${staffId}|${normIso(startsAt)}|${normIso(endsAt)}`;
    if (existingKeys.has(key)) {
      skipped.duplicate += 1;
      continue;
    }
    existingKeys.add(key);

    workRows.push({
      restaurant_id: restaurant.id,
      staff_id: staffId,
      entry_type: entryType,
      starts_at: normIso(startsAt),
      ends_at: normIso(endsAt),
      note: typeName === "Request" ? "Request (Bubble)" : null,
      is_open: false,
    });

    console.log(
      `  + ${emp.FirstName} ${emp.LastName} · ${typeName} · ${normIso(startsAt)} → ${normIso(endsAt)}`,
    );
  }

  console.log("");
  console.log(`Bubble am Tag: ${onDay.length}, neu: ${workRows.length}, Duplikate: ${skipped.duplicate}, unmapped: ${skipped.unmapped}`);

  if (DRY_RUN || workRows.length === 0) {
    if (DRY_RUN) console.log("[dry-run] Keine DB-Schreibzugriffe.");
    return;
  }

  for (let i = 0; i < workRows.length; i += 100) {
    const chunk = workRows.slice(i, i + 100);
    const { error } = await admin.from("restaurant_staff_work_entries").insert(chunk);
    if (error) throw new Error(`Insert: ${error.message}`);
  }

  console.log(`✓ ${workRows.length} Einträge importiert.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
