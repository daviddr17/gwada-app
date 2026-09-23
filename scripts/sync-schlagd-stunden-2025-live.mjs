/**
 * Zur Schlagd Live:
 * 1) Fehlende Mitarbeiter aus Stundenübersicht-Köpfen anlegen + Vertrags-PDFs zuordnen
 * 2) Arbeitszeiten 2025 an Stundenübersichten angleichen (2026 unverändert)
 *
 *   pnpm exec dotenv -e .env.production -- node scripts/sync-schlagd-stunden-2025-live.mjs
 *   DRY_RUN=1 …
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(".env.production"), quiet: true });

const require = createRequire(import.meta.url);
const { PDFDocument } = (() => {
  try {
    // optional — we use pdfjs via python pre-parse instead
    return {};
  } catch {
    return {};
  }
})();

const DRY_RUN = process.env.DRY_RUN === "1";
const RESTAURANT_SLUG = "zurschlagd";
const TZ = "Europe/Berlin";
const BUCKET = "restaurant-documents";
const TAG_NAME = "Mitarbeiter";

const HOURS_DIR =
  process.env.SCHLAGD_HOURS_DIR ||
  "/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Schlagd/2026/Prüfung/Stundenuebersicht";
const CONTRACT_DIR =
  process.env.SCHLAGD_CONTRACTS_DIR ||
  "/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Schlagd/2026/Prüfung/Arbeitsverträge";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const MISSING = [
  {
    given: "Daniela",
    family: "Walther",
    contract: "Arbeitsvertrag Daniela Walther.pdf",
    overview: "Daniela-Walther_Stundenuebersicht.pdf",
  },
  {
    given: "Frank Herbert",
    family: "Dreyer",
    contract: "Arbeitsvertrag Frank Herbert Dreyer 2026.pdf",
    overview: "Frank-Herbert-Dreyer_Stundenuebersicht.pdf",
  },
  {
    given: "Laura",
    family: "Löffler",
    contract: "Arbeitsvertrag Laura Loeffler.pdf",
    overview: "Laura-Loeffler_Stundenuebersicht.pdf",
  },
  {
    given: "Wilhelm Bernd",
    family: "Herwig",
    contract: "Arbeitsvertrag Wilhelm Bernd Herwig.pdf",
    overview: "Wilhelm-Bernd-Herwig_Stundenuebersicht.pdf",
  },
  {
    given: "Willi",
    family: "Klingspon",
    contract: "Arbeitsvertrag Willi Klingspon.pdf",
    overview: "Willi-Klingspon_Stundenuebersicht.pdf",
  },
];

function norm(s) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function staffFull(s) {
  return `${s.given_name || ""} ${s.family_name || ""}`.trim();
}

/** Europe/Berlin local wall time → UTC ISO */
function berlinLocalToUtcIso(dateYmd, hhmm) {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  function berlinToUtc(parts) {
    const guess = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second || 0,
    );
    const shown = Object.fromEntries(
      fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
    );
    const shownMs = Date.UTC(
      Number(shown.year),
      Number(shown.month) - 1,
      Number(shown.day),
      Number(shown.hour === "24" ? "0" : shown.hour),
      Number(shown.minute),
      Number(shown.second),
    );
    return new Date(guess + (guess - shownMs));
  }
  return berlinToUtc({
    year: y,
    month: m,
    day: d,
    hour: hh,
    minute: mm,
    second: 0,
  }).toISOString();
}

function berlinYear(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
  }).format(new Date(iso));
}

function parseOverviewPdfText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const header = {
    name: lines[0] || null,
    birthDate: null,
    addressLine1: null,
    postalCode: null,
    city: null,
    personalNr: null,
  };
  for (const ln of lines.slice(0, 12)) {
    let m = ln.match(/^Geburtsdatum\s+(\d{2})\.(\d{2})\.(\d{4})/);
    if (m) header.birthDate = `${m[3]}-${m[2]}-${m[1]}`;
    m = ln.match(/^Personal-Nr\.\s*(\d+)/);
    if (m) header.personalNr = m[1];
    m = ln.match(/^(.+),\s*(\d{5})\s+(.+)$/);
    if (m && !ln.includes("Export") && !ln.includes("Geburts")) {
      header.addressLine1 = m[1].trim();
      header.postalCode = m[2];
      header.city = m[3].trim();
    }
  }

  const work = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d{2})\.(\d{2})\.(2025|2026)$/);
    if (!m || i + 5 >= lines.length) continue;
    const [, dd, mo, year] = m;
    const start = lines[i + 2];
    const end = lines[i + 3];
    const pause = lines[i + 4];
    const hours = lines[i + 5];
    if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) continue;
    if (!/^[\d]+([,.]\d+)?$/.test(hours)) continue;
    let pauseRange = null;
    const pm = pause.match(/^(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})$/);
    if (pm) pauseRange = { start: pm[1], end: pm[2] };
    work.push({
      date: `${year}-${mo}-${dd}`,
      year: Number(year),
      start,
      end,
      pause: pauseRange,
      hours: Number(hours.replace(",", ".")),
    });
    i += 5;
  }
  return { header, work };
}

async function extractPdfTextWithPython(pdfPath) {
  const { spawnSync } = await import("node:child_process");
  const py = `
import fitz, sys
doc = fitz.open(sys.argv[1])
print("\\n".join(page.get_text() or "" for page in doc))
`;
  const r = spawnSync("python3", ["-c", py, pdfPath], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || "pdf extract failed");
  return r.stdout;
}

function storagePath(restaurantId, documentId, fileName) {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
  return `${restaurantId}/${documentId}/${safe || "datei"}`;
}

async function resolveTagId(restaurantId) {
  const { data: settings } = await sb
    .from("restaurant_staff_module_settings")
    .select("contract_document_tag_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (settings?.contract_document_tag_id) return settings.contract_document_tag_id;
  const { data: existing } = await sb
    .from("restaurant_document_tags")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .ilike("name", TAG_NAME)
    .maybeSingle();
  if (existing?.id) {
    await sb.from("restaurant_staff_module_settings").upsert(
      { restaurant_id: restaurantId, contract_document_tag_id: existing.id },
      { onConflict: "restaurant_id" },
    );
    return existing.id;
  }
  const { data: created, error } = await sb
    .from("restaurant_document_tags")
    .insert({
      restaurant_id: restaurantId,
      name: TAG_NAME,
      is_active: true,
      background_color: "#64748b",
    })
    .select("id")
    .single();
  if (error) throw error;
  await sb.from("restaurant_staff_module_settings").upsert(
    { restaurant_id: restaurantId, contract_document_tag_id: created.id },
    { onConflict: "restaurant_id" },
  );
  return created.id;
}

function matchStaff(personName, staff) {
  const target = norm(personName);
  const scored = staff
    .map((s) => {
      const full = norm(staffFull(s));
      let score = 0;
      if (full === target) score = 100;
      else if (full.includes(target) || target.includes(full)) score = 80;
      else {
        const tp = target.split(" ").filter(Boolean);
        const sp = full.split(" ").filter(Boolean);
        const overlap = tp.filter((t) =>
          sp.some((x) => x === t || x.startsWith(t) || t.startsWith(x)),
        ).length;
        score = overlap * 18;
        if (tp.length && overlap >= Math.min(2, tp.length)) score = Math.max(score, 70);
      }
      if (s.is_active) score += 3;
      return { s, score };
    })
    .filter((x) => x.score >= 55)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.s ?? null;
}

const OVERVIEW_ALIASES = {
  "rhaman al dhefiri": "rahman al dhefiri",
  "ezmeray mohammadi": "ezmaray mohammadi",
  "moritz hermann rolf hebaum": "moritz hebaum",
  "pascal juergen glor": "pascal glor",
  "anna sophia scharnhorst": "anna sophia scharnhorst",
  "daniel hermann arno kliebisch": "daniel kliebisch",
  "alomar alsulaiman leith": "leith alomar alsulaiman",
  "laura loeffler": "laura loffler",
  "sienna catherina kalden": "sienna kalden",
  "mohamad adnan": "adnan mohamad",
  "yannick lueckert": "yannick luckert",
};

async function uploadContract({
  restaurantId,
  staffId,
  tagId,
  uploaderId,
  filePath,
  fileName,
}) {
  const buf = readFileSync(filePath);
  const documentId = randomUUID();
  const path = storagePath(restaurantId, documentId, fileName);
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) throw upErr;
  const title = fileName.replace(/\.pdf$/i, "");
  const { error: docErr } = await sb.from("restaurant_documents").insert({
    id: documentId,
    restaurant_id: restaurantId,
    tag_id: tagId,
    staff_id: staffId,
    visible_to_staff: true,
    title,
    file_name: fileName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_"),
    storage_path: path,
    mime_type: "application/pdf",
    size_bytes: buf.length,
    uploaded_by: uploaderId,
  });
  if (docErr) {
    await sb.storage.from(BUCKET).remove([path]);
    throw docErr;
  }

  const { data: existing } = await sb
    .from("restaurant_staff_contracts")
    .select("id, current_document_id")
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffId)
    .order("valid_from", { ascending: false });
  const open = (existing || []).find((c) => !c.current_document_id);
  let contractId = open?.id ?? null;
  if (!contractId) {
    const { data: inserted, error } = await sb
      .from("restaurant_staff_contracts")
      .insert({
        restaurant_id: restaurantId,
        staff_id: staffId,
        valid_from: "2025-04-01",
        valid_to: null,
        pay_type: "hourly",
        hourly_rate_cents: 1500,
        currency: "EUR",
        note: "Import PDF Prüfung — Betrag ggf. prüfen",
        contract_source: "external",
        current_document_id: documentId,
        employee_signature_pending: false,
      })
      .select("id")
      .single();
    if (error) throw error;
    contractId = inserted.id;
  } else {
    const { error } = await sb
      .from("restaurant_staff_contracts")
      .update({
        contract_source: "external",
        current_document_id: documentId,
        employee_signature_pending: false,
      })
      .eq("id", contractId);
    if (error) throw error;
  }

  const { data: versions } = await sb
    .from("restaurant_staff_contract_document_versions")
    .select("version")
    .eq("contract_id", contractId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = Number(versions?.[0]?.version ?? 0) + 1;
  await sb
    .from("restaurant_staff_contract_document_versions")
    .update({ is_current: false })
    .eq("contract_id", contractId)
    .eq("is_current", true);
  await sb.from("restaurant_staff_contract_document_versions").insert({
    restaurant_id: restaurantId,
    contract_id: contractId,
    document_id: documentId,
    version: nextVersion,
    is_current: true,
    actor_user_id: uploaderId,
  });
  await sb.from("restaurant_staff_contract_log_entries").insert({
    restaurant_id: restaurantId,
    contract_id: contractId,
    actor_user_id: uploaderId,
    action: "external_uploaded",
    details: {
      summary: `Vertragsdokument importiert (${fileName})`,
      pdfSha256: createHash("sha256").update(buf).digest("hex"),
      changes: [],
    },
  });
  return contractId;
}

async function deleteStaffYear2025Entries(restaurantId, staffId) {
  // Wide UTC window covering Berlin 2025; delete in small id chunks (URI limit).
  let deleted = 0;
  for (;;) {
    const { data, error } = await sb
      .from("restaurant_staff_work_entries")
      .select("id, starts_at")
      .eq("restaurant_id", restaurantId)
      .eq("staff_id", staffId)
      .gte("starts_at", "2024-12-31T00:00:00.000Z")
      .lt("starts_at", "2026-01-01T12:00:00.000Z")
      .order("starts_at", { ascending: true })
      .limit(120);
    if (error) throw error;
    const ids = (data || [])
      .filter((r) => berlinYear(r.starts_at) === "2025")
      .map((r) => r.id);
    if (!ids.length) break;
    for (let i = 0; i < ids.length; i += 40) {
      const chunk = ids.slice(i, i + 40);
      const { error: delErr } = await sb
        .from("restaurant_staff_work_entries")
        .delete()
        .in("id", chunk);
      if (delErr) throw delErr;
      deleted += chunk.length;
    }
  }
  return deleted;
}

async function insertWorkRows(restaurantId, staffId, uploaderId, rows2025) {
  const inserts = [];
  for (const row of rows2025) {
    inserts.push({
      restaurant_id: restaurantId,
      staff_id: staffId,
      entry_type: "work",
      starts_at: berlinLocalToUtcIso(row.date, row.start),
      ends_at: berlinLocalToUtcIso(row.date, row.end),
      is_open: false,
      note: "Import Stundenübersicht Prüfung 2025",
      created_by: uploaderId,
    });
    if (row.pause) {
      inserts.push({
        restaurant_id: restaurantId,
        staff_id: staffId,
        entry_type: "break",
        starts_at: berlinLocalToUtcIso(row.date, row.pause.start),
        ends_at: berlinLocalToUtcIso(row.date, row.pause.end),
        is_open: false,
        note: "Import Stundenübersicht Prüfung 2025 (Pause)",
        created_by: uploaderId,
      });
    }
  }
  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200);
    const { error } = await sb.from("restaurant_staff_work_entries").insert(chunk);
    if (error) throw error;
  }
  return inserts.length;
}

async function main() {
  const { data: rest, error: restErr } = await sb
    .from("restaurants")
    .select("id, name")
    .eq("slug", RESTAURANT_SLUG)
    .single();
  if (restErr) throw restErr;

  let { data: staff, error: staffErr } = await sb
    .from("restaurant_staff")
    .select(
      "id, given_name, family_name, is_active, profile_id, birth_date, address_line1, postal_code, city",
    )
    .eq("restaurant_id", rest.id);
  if (staffErr) throw staffErr;
  staff = staff || [];

  const david = staff.find(
    (s) => norm(s.given_name) === "david" && norm(s.family_name) === "dreyer" && s.profile_id,
  );
  if (!david?.profile_id) throw new Error("David Dreyer profile_id fehlt");
  const uploaderId = david.profile_id;

  console.log(`Restaurant ${rest.name} · staff ${staff.length} · DRY_RUN=${DRY_RUN}`);

  // --- 1) Create missing staff + contracts ---
  const tagId = DRY_RUN ? null : await resolveTagId(rest.id);
  for (const miss of MISSING) {
    const existing = staff.find(
      (s) =>
        norm(s.given_name) === norm(miss.given) &&
        norm(s.family_name) === norm(miss.family),
    );
    const overviewPath = join(HOURS_DIR, miss.overview);
    let header = {};
    if (existsSync(overviewPath)) {
      const text = await extractPdfTextWithPython(overviewPath);
      header = parseOverviewPdfText(text).header;
    }
    let staffId = existing?.id;
    if (!existing) {
      console.log(
        `CREATE ${miss.given} ${miss.family} birth=${header.birthDate || "?"} ${header.postalCode || ""} ${header.city || ""}`,
      );
      if (!DRY_RUN) {
        const { data: inserted, error } = await sb
          .from("restaurant_staff")
          .insert({
            restaurant_id: rest.id,
            given_name: miss.given,
            family_name: miss.family,
            birth_date: header.birthDate,
            address_line1: header.addressLine1,
            postal_code: header.postalCode,
            city: header.city,
            country: "Deutschland",
            is_active: true,
            profile_id: null,
            employee_id: null,
          })
          .select("id")
          .single();
        if (error) throw error;
        staffId = inserted.id;
        staff.push({
          id: staffId,
          given_name: miss.given,
          family_name: miss.family,
          is_active: true,
          profile_id: null,
        });
      }
    } else {
      console.log(`EXISTS ${miss.given} ${miss.family}`);
      if (!DRY_RUN && header.birthDate) {
        await sb
          .from("restaurant_staff")
          .update({
            birth_date: header.birthDate,
            address_line1: header.addressLine1 ?? existing.address_line1,
            postal_code: header.postalCode ?? existing.postal_code,
            city: header.city ?? existing.city,
            country: "Deutschland",
          })
          .eq("id", existing.id);
      }
    }

    const contractPath = join(CONTRACT_DIR, miss.contract);
    if (!existsSync(contractPath)) {
      // try NFC/NFD variants
      const found = readdirSync(CONTRACT_DIR).find(
        (f) => norm(f) === norm(miss.contract),
      );
      if (!found) {
        console.log(`  WARN contract missing: ${miss.contract}`);
        continue;
      }
      if (!DRY_RUN && staffId) {
        await uploadContract({
          restaurantId: rest.id,
          staffId,
          tagId,
          uploaderId,
          filePath: join(CONTRACT_DIR, found),
          fileName: found,
        });
        console.log(`  OK contract ${found}`);
      }
    } else if (!DRY_RUN && staffId) {
      const { data: docs } = await sb
        .from("restaurant_documents")
        .select("id")
        .eq("restaurant_id", rest.id)
        .eq("staff_id", staffId)
        .ilike("title", "%Arbeitsvertrag%")
        .limit(1);
      if (docs?.length) {
        console.log(`  SKIP contract already present`);
      } else {
        await uploadContract({
          restaurantId: rest.id,
          staffId,
          tagId,
          uploaderId,
          filePath: contractPath,
          fileName: miss.contract,
        });
        console.log(`  OK contract ${miss.contract}`);
      }
    }
  }

  // refresh staff
  ({ data: staff } = await sb
    .from("restaurant_staff")
    .select("id, given_name, family_name, is_active, profile_id")
    .eq("restaurant_id", rest.id));
  staff = staff || [];

  // --- 2) Sync 2025 hours from all Stundenübersichten ---
  const files = readdirSync(HOURS_DIR).filter((f) =>
    f.endsWith("_Stundenuebersicht.pdf"),
  );
  let totalDeleted = 0;
  let totalInserted = 0;
  let matched = 0;
  let unmatched = [];

  for (const file of files) {
    const personFromFile = file
      .replace(/_Stundenuebersicht\.pdf$/i, "")
      .replace(/-/g, " ");
    const aliasKey = norm(personFromFile);
    const lookup = OVERVIEW_ALIASES[aliasKey] || aliasKey;
    const text = await extractPdfTextWithPython(join(HOURS_DIR, file));
    const parsed = parseOverviewPdfText(text);
    const nameForMatch = parsed.header.name || personFromFile;
    const s =
      matchStaff(OVERVIEW_ALIASES[norm(nameForMatch)] || nameForMatch, staff) ||
      matchStaff(lookup, staff);
    if (!s) {
      unmatched.push(nameForMatch);
      continue;
    }
    matched++;
    const rows2025 = parsed.work.filter((w) => w.year === 2025);
    console.log(
      `HOURS ${staffFull(s)} ← ${file}: 2025 shifts=${rows2025.length}`,
    );
    if (DRY_RUN) continue;
    const deleted = await deleteStaffYear2025Entries(rest.id, s.id);
    const inserted = await insertWorkRows(
      rest.id,
      s.id,
      uploaderId,
      rows2025,
    );
    totalDeleted += deleted;
    totalInserted += inserted;
    console.log(`  deleted ${deleted} · inserted ${inserted}`);
  }

  console.log(
    `\nDone hours: matched=${matched} unmatched=${unmatched.length} deleted2025=${totalDeleted} inserted=${totalInserted}`,
  );
  if (unmatched.length) console.log("Unmatched overviews:", unmatched.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
