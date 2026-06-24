import "server-only";

import { resolveCountryIso2FromLabel } from "@/lib/constants/countries";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchPlatformStaffContractTemplates } from "@/lib/supabase/platform-contract-templates-db";
import type {
  PlatformEmploymentLegacyKey,
  PlatformStaffContractCatalogItem,
} from "@/lib/types/platform-contract-templates";

export async function listPlatformContractCatalog(params: {
  restaurantId: string;
  employmentTypeId?: string | null;
}): Promise<
  | { ok: true; countryCode: string; items: PlatformStaffContractCatalogItem[] }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("country")
    .eq("id", params.restaurantId)
    .maybeSingle();

  const countryCode = resolveCountryIso2FromLabel(
    typeof restaurant?.country === "string" ? restaurant.country : "DE",
  );

  const { templates, error } = await fetchPlatformStaffContractTemplates(admin, {
    countryCode,
    activeOnly: true,
  });

  if (error) {
    return { ok: false, error, status: 500 };
  }

  const { data: employmentTypes } = await admin
    .from("restaurant_staff_employment_types")
    .select("id, legacy_key")
    .eq("restaurant_id", params.restaurantId);

  const employmentByLegacy = new Map<string, string>();
  for (const row of employmentTypes ?? []) {
    if (row.legacy_key) {
      employmentByLegacy.set(row.legacy_key as string, row.id as string);
    }
  }

  const { data: importedRows } = await admin
    .from("restaurant_staff_contract_templates")
    .select(
      "id, platform_template_id, imported_platform_version, employment_type_id",
    )
    .eq("restaurant_id", params.restaurantId)
    .not("platform_template_id", "is", null);

  const importedByPlatformAndEmployment = new Map<
    string,
    { id: string; version: number | null }
  >();
  for (const row of importedRows ?? []) {
    if (!row.platform_template_id || !row.employment_type_id) continue;
    const key = `${row.platform_template_id as string}:${row.employment_type_id as string}`;
    importedByPlatformAndEmployment.set(key, {
      id: row.id as string,
      version:
        row.imported_platform_version == null
          ? null
          : Number(row.imported_platform_version),
    });
  }

  const items: PlatformStaffContractCatalogItem[] = templates.map((t) => {
    const catalogEmploymentTypeId =
      params.employmentTypeId ??
      employmentByLegacy.get(t.employmentLegacyKey) ??
      null;
    const importKey = catalogEmploymentTypeId
      ? `${t.id}:${catalogEmploymentTypeId}`
      : null;
    const imported = importKey
      ? importedByPlatformAndEmployment.get(importKey)
      : [...importedByPlatformAndEmployment.entries()].find(([k]) =>
          k.startsWith(`${t.id}:`),
        )?.[1];
    return {
      id: t.id,
      countryCode: t.countryCode,
      employmentLegacyKey: t.employmentLegacyKey as PlatformEmploymentLegacyKey,
      name: t.name,
      title: t.title,
      legalNotice: t.legalNotice,
      version: t.version,
      alreadyImported: Boolean(imported),
      importedRestaurantTemplateId: imported?.id ?? null,
      updateAvailable: Boolean(
        imported && imported.version != null && imported.version < t.version,
      ),
    };
  });

  return { ok: true, countryCode, items };
}

export async function importPlatformContractTemplates(params: {
  restaurantId: string;
  platformTemplateIds?: string[];
  employmentTypeId?: string | null;
  importAllForCountry?: boolean;
}): Promise<
  | {
      ok: true;
      imported: number;
      skipped: number;
      templateIds: string[];
    }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const catalog = await listPlatformContractCatalog({
    restaurantId: params.restaurantId,
    employmentTypeId: params.employmentTypeId,
  });

  if (!catalog.ok) {
    return { ok: false, error: catalog.error, status: catalog.status };
  }

  let targets = catalog.items;
  if (params.platformTemplateIds?.length) {
    const idSet = new Set(params.platformTemplateIds);
    targets = targets.filter((t) => idSet.has(t.id));
  }

  if (params.importAllForCountry) {
    targets = targets.filter((t) => !t.alreadyImported);
  }

  if (targets.length === 0) {
    return { ok: true, imported: 0, skipped: 0, templateIds: [] };
  }

  const { data: employmentTypes } = await admin
    .from("restaurant_staff_employment_types")
    .select("id, legacy_key")
    .eq("restaurant_id", params.restaurantId);

  const employmentByLegacy = new Map<string, string>();
  for (const row of employmentTypes ?? []) {
    if (row.legacy_key) {
      employmentByLegacy.set(row.legacy_key as string, row.id as string);
    }
  }

  const { data: importedRows } = await admin
    .from("restaurant_staff_contract_templates")
    .select(
      "id, platform_template_id, imported_platform_version, employment_type_id",
    )
    .eq("restaurant_id", params.restaurantId)
    .not("platform_template_id", "is", null);

  const importedByPlatformAndEmployment = new Map<
    string,
    { id: string; version: number | null }
  >();
  for (const row of importedRows ?? []) {
    if (!row.platform_template_id || !row.employment_type_id) continue;
    const key = `${row.platform_template_id as string}:${row.employment_type_id as string}`;
    importedByPlatformAndEmployment.set(key, {
      id: row.id as string,
      version:
        row.imported_platform_version == null
          ? null
          : Number(row.imported_platform_version),
    });
  }

  let imported = 0;
  let skipped = 0;
  const templateIds: string[] = [];

  for (const target of targets) {
    const employmentTypeId =
      params.employmentTypeId ??
      employmentByLegacy.get(target.employmentLegacyKey) ??
      null;

    if (!employmentTypeId) {
      skipped += 1;
      continue;
    }

    const importKey = `${target.id}:${employmentTypeId}`;
    const existingImport = importedByPlatformAndEmployment.get(importKey);

    if (existingImport) {
      skipped += 1;
      continue;
    }

    const { data: platformTemplate } = await admin
      .from("platform_staff_contract_templates")
      .select("id, name, title, version")
      .eq("id", target.id)
      .maybeSingle();

    if (!platformTemplate) {
      skipped += 1;
      continue;
    }

    const { data: paragraphs } = await admin
      .from("platform_staff_contract_template_paragraphs")
      .select("sort_order, heading, body")
      .eq("template_id", target.id)
      .order("sort_order");

    const { count } = await admin
      .from("restaurant_staff_contract_templates")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", params.restaurantId)
      .eq("employment_type_id", employmentTypeId);

    const { data: inserted, error: insertError } = await admin
      .from("restaurant_staff_contract_templates")
      .insert({
        restaurant_id: params.restaurantId,
        employment_type_id: employmentTypeId,
        name: platformTemplate.name as string,
        title: platformTemplate.title as string,
        sort_order: Number(count ?? 0),
        is_active: true,
        platform_template_id: target.id,
        imported_platform_version: Number(platformTemplate.version ?? 1),
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      skipped += 1;
      continue;
    }

    const paragraphRows = (paragraphs ?? []).map((p) => ({
      template_id: inserted.id as string,
      sort_order: Number(p.sort_order ?? 0),
      heading: (p.heading as string | null) ?? null,
      body: String(p.body ?? ""),
    }));

    if (paragraphRows.length > 0) {
      const { error: paragraphError } = await admin
        .from("restaurant_staff_contract_template_paragraphs")
        .insert(paragraphRows);
      if (paragraphError) {
        await admin
          .from("restaurant_staff_contract_templates")
          .delete()
          .eq("id", inserted.id);
        skipped += 1;
        continue;
      }
    }

    imported += 1;
    templateIds.push(inserted.id as string);
  }

  return { ok: true, imported, skipped, templateIds };
}

export async function handlePlatformContractCatalogRequest(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim();
  const employmentTypeId = url.searchParams.get("employmentTypeId")?.trim() || null;

  if (!restaurantId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(restaurantId, "read");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await listPlatformContractCatalog({ restaurantId, employmentTypeId });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    countryCode: result.countryCode,
    items: result.items,
  });
}

export async function handleImportPlatformContractTemplatesRequest(
  req: Request,
): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    employmentTypeId?: string | null;
    platformTemplateIds?: string[];
    importAllForCountry?: boolean;
  } | null;

  if (!body?.restaurantId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(body.restaurantId, "update");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await importPlatformContractTemplates({
    restaurantId: body.restaurantId,
    employmentTypeId: body.employmentTypeId ?? null,
    platformTemplateIds: body.platformTemplateIds,
    importAllForCountry: body.importAllForCountry === true,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    imported: result.imported,
    skipped: result.skipped,
    templateIds: result.templateIds,
  });
}
