/**
 * One-off: Arbeitsvertrags-PDFs (iCloud Schlagd/Prüfung) → Live zurschlagd
 * als externe Verträge mit Dokument.
 *
 *   dotenv -e .env.production -- node scripts/import-schlagd-arbeitsvertraege-live.mjs
 *   DRY_RUN=1 …  (nur Matching)
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(".env.production"), quiet: true });

const DRY_RUN = process.env.DRY_RUN === "1";
const RESTAURANT_SLUG = "zurschlagd";
const DIR =
  process.env.SCHLAGD_CONTRACTS_DIR ||
  "/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Schlagd/2026/Prüfung/Arbeitsverträge";
const BUCKET = "restaurant-documents";
const TAG_NAME = "Mitarbeiter";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

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

const ALIASES = {
  "anna scharnhorst": "anna sophia scharnhorst",
  "alomar alsulaiman leith": "leith alomar alsulaiman",
  "daniel hermann arno kliebisch": "daniel kliebisch",
  "pascal juergen glor": "pascal glor",
  "yannick lueckert": "yannick luckert",
  "sienna catherina kalden": "sienna kalden",
  "mohamad adnan": "adnan mohamad",
  "kirsten egermann": "kirsten egermann herwig",
  "ezmaray mohamadi": "ezmaray mohammadi",
  "moritz rolf hebaum": "moritz hebaum",
  hossain: "hossain haideri",
};

function parseFile(fname) {
  let stem = fname.replace(/\.pdf$/i, "");
  const isErg = /^erg[aä]nzung\s+/i.test(stem);
  stem = stem
    .replace(/^arbeits?vertrag\s+/i, "")
    .replace(/^arbeitvertrag\s+/i, "")
    .replace(/^erg[aä]nzung\s+/i, "");
  let year = null;
  const m = stem.match(/\s+(20\d{2})$/);
  if (m) {
    year = Number(m[1]);
    stem = stem.slice(0, m.index).trim();
  }
  return { person: stem, year, isErg, fname };
}

function matchStaff(personKey, staff) {
  const target = norm(ALIASES[personKey] || personKey);
  const scored = staff
    .map((s) => {
      const full = norm(staffFull(s));
      const rev = norm(`${s.family_name || ""} ${s.given_name || ""}`);
      let score = 0;
      if (full === target || rev === target) score = 100;
      else if (full.includes(target) || target.includes(full)) score = 80;
      else {
        const tparts = target.split(" ").filter(Boolean);
        const sparts = full.split(" ").filter(Boolean);
        const overlap = tparts.filter((t) =>
          sparts.some((sp) => sp === t || sp.startsWith(t) || t.startsWith(sp)),
        ).length;
        score = overlap * 20;
        if (tparts.length && overlap === tparts.length) score = 90;
      }
      if (s.is_active) score += 5;
      return { s, score };
    })
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score);
  return scored[0] || null;
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
  if (error || !created?.id) throw new Error(error?.message || "tag create failed");
  await sb.from("restaurant_staff_module_settings").upsert(
    { restaurant_id: restaurantId, contract_document_tag_id: created.id },
    { onConflict: "restaurant_id" },
  );
  return created.id;
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

async function main() {
  const { data: rest, error: restErr } = await sb
    .from("restaurants")
    .select("id, name")
    .eq("slug", RESTAURANT_SLUG)
    .single();
  if (restErr || !rest) throw new Error(restErr?.message || "restaurant missing");

  const { data: staff, error: staffErr } = await sb
    .from("restaurant_staff")
    .select("id, given_name, family_name, is_active, profile_id")
    .eq("restaurant_id", rest.id);
  if (staffErr) throw new Error(staffErr.message);

  const { data: contracts, error: cErr } = await sb
    .from("restaurant_staff_contracts")
    .select(
      "id, staff_id, valid_from, valid_to, current_document_id, contract_source, signed_at",
    )
    .eq("restaurant_id", rest.id);
  if (cErr) throw new Error(cErr.message);

  const david = (staff || []).find(
    (s) =>
      norm(s.given_name) === "david" &&
      norm(s.family_name) === "dreyer" &&
      s.profile_id,
  );
  const uploaderId = david?.profile_id;
  if (!uploaderId && !DRY_RUN) {
    throw new Error("David Dreyer profile_id fehlt — uploaded_by nötig");
  }

  const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  const byPerson = new Map();
  for (const f of files) {
    const p = parseFile(f);
    const key = norm(p.person);
    const prev = byPerson.get(key);
    if (
      !prev ||
      (p.year || 0) > (prev.year || 0) ||
      (p.year === prev.year && !p.isErg && prev.isErg)
    ) {
      byPerson.set(key, p);
    }
  }

  // One best PDF per staff_id
  const byStaff = new Map();
  const misses = [];
  const ergFiles = [];

  for (const [key, p] of byPerson) {
    if (p.isErg) {
      ergFiles.push(p);
      continue;
    }
    const m = matchStaff(key, staff || []);
    if (!m) {
      misses.push(p);
      continue;
    }
    const prev = byStaff.get(m.s.id);
    if (!prev || (p.year || 0) > (prev.p.year || 0)) {
      byStaff.set(m.s.id, { p, staff: m.s, score: m.score });
    }
  }

  console.log(
    `Restaurant ${rest.name} · PDFs ${files.length} · unique staff matches ${byStaff.size} · miss ${misses.length}`,
  );
  if (misses.length) {
    console.log(
      "Unmatched:",
      misses.map((m) => m.person).join(", "),
    );
  }
  if (DRY_RUN) {
    for (const { p, staff: s } of byStaff.values()) {
      const existing = (contracts || []).filter((c) => c.staff_id === s.id);
      console.log(
        `DRY ${p.fname} → ${staffFull(s)} contracts=${existing.length}`,
      );
    }
    return;
  }

  const tagId = await resolveTagId(rest.id);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const { p, staff: s } of byStaff.values()) {
    const existing = (contracts || [])
      .filter((c) => c.staff_id === s.id)
      .sort((a, b) => String(b.valid_from).localeCompare(String(a.valid_from)));

    const withDoc = existing.find((c) => c.current_document_id);
    if (withDoc) {
      console.log(`SKIP already has doc: ${staffFull(s)}`);
      skipped++;
      continue;
    }

    const targetContract = existing.find((c) => !c.current_document_id) || null;
    const buf = readFileSync(join(DIR, p.fname));
    const documentId = randomUUID();
    const path = storagePath(rest.id, documentId, p.fname);
    const sha = createHash("sha256").update(buf).digest("hex");
    const title = p.fname.replace(/\.pdf$/i, "");
    const validFrom =
      p.year && p.year >= 2020 ? `${p.year}-04-01` : "2025-04-01";

    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (upErr) {
      console.error(`FAIL upload ${staffFull(s)}:`, upErr.message);
      failed++;
      continue;
    }

    const { error: docErr } = await sb.from("restaurant_documents").insert({
      id: documentId,
      restaurant_id: rest.id,
      tag_id: tagId,
      staff_id: s.id,
      visible_to_staff: true,
      title,
      file_name: p.fname,
      storage_path: path,
      mime_type: "application/pdf",
      size_bytes: buf.length,
      uploaded_by: uploaderId,
    });
    if (docErr) {
      await sb.storage.from(BUCKET).remove([path]);
      console.error(`FAIL doc row ${staffFull(s)}:`, docErr.message);
      failed++;
      continue;
    }

    let contractId = targetContract?.id ?? null;
    if (!contractId) {
      const { data: inserted, error: insErr } = await sb
        .from("restaurant_staff_contracts")
        .insert({
          restaurant_id: rest.id,
          staff_id: s.id,
          valid_from: validFrom,
          valid_to: null,
          pay_type: "hourly",
          hourly_rate_cents: 1500,
          currency: "EUR",
          note: "Import PDF Prüfung/Arbeitsverträge — Betrag ggf. prüfen",
          contract_source: "external",
          current_document_id: documentId,
          employee_signature_pending: false,
        })
        .select("id")
        .single();
      if (insErr || !inserted?.id) {
        console.error(`FAIL contract ${staffFull(s)}:`, insErr?.message);
        failed++;
        continue;
      }
      contractId = inserted.id;
    } else {
      const { error: updErr } = await sb
        .from("restaurant_staff_contracts")
        .update({
          contract_source: "external",
          current_document_id: documentId,
          employee_signature_pending: false,
          contract_body_snapshot: null,
          signature_employer: null,
          signature_employee: null,
        })
        .eq("id", contractId);
      if (updErr) {
        console.error(`FAIL contract update ${staffFull(s)}:`, updErr.message);
        failed++;
        continue;
      }
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
      restaurant_id: rest.id,
      contract_id: contractId,
      document_id: documentId,
      version: nextVersion,
      is_current: true,
      actor_user_id: uploaderId,
    });

    await sb.from("restaurant_staff_contract_log_entries").insert({
      restaurant_id: rest.id,
      contract_id: contractId,
      actor_user_id: uploaderId,
      action: "external_uploaded",
      summary: `Vertragsdokument importiert (${p.fname})`,
      pdf_sha256: sha,
    });

    console.log(`OK ${staffFull(s)} ← ${p.fname}`);
    uploaded++;
  }

  // Ergänzungen als zusätzliches Dokument am Staff (kein zweiter Hauptvertrag)
  for (const p of ergFiles) {
    const m = matchStaff(norm(p.person), staff || []);
    if (!m) {
      console.log(`SKIP erg unmatched ${p.fname}`);
      continue;
    }
    const buf = readFileSync(join(DIR, p.fname));
    const documentId = randomUUID();
    const path = storagePath(rest.id, documentId, p.fname);
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (upErr) {
      console.error(`FAIL erg upload:`, upErr.message);
      continue;
    }
    const { error: docErr } = await sb.from("restaurant_documents").insert({
      id: documentId,
      restaurant_id: rest.id,
      tag_id: tagId,
      staff_id: m.s.id,
      visible_to_staff: true,
      title: p.fname.replace(/\.pdf$/i, ""),
      file_name: p.fname,
      storage_path: path,
      mime_type: "application/pdf",
      size_bytes: buf.length,
      uploaded_by: uploaderId,
    });
    if (docErr) {
      await sb.storage.from(BUCKET).remove([path]);
      console.error(`FAIL erg doc:`, docErr.message);
      continue;
    }
    console.log(`OK erg ${staffFull(m.s)} ← ${p.fname}`);
    uploaded++;
  }

  console.log(
    `\nDone: uploaded=${uploaded} skipped=${skipped} failed=${failed} unmatched=${misses.length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
