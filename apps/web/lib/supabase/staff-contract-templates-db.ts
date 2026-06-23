import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  StaffContractTemplateParagraphRow,
  StaffContractTemplateRow,
} from "@/lib/types/staff-contract-templates";

export type StaffContractTemplateDraftParagraph = {
  id?: string;
  heading: string;
  body: string;
};

export type StaffContractTemplateWithParagraphs = StaffContractTemplateRow & {
  paragraphs: StaffContractTemplateParagraphRow[];
};

function mapParagraphRow(r: Record<string, unknown>): StaffContractTemplateParagraphRow {
  return {
    id: r.id as string,
    template_id: r.template_id as string,
    sort_order: Number(r.sort_order ?? 0),
    heading: (r.heading as string | null) ?? null,
    body: String(r.body ?? ""),
  };
}

function mapTemplateRow(r: Record<string, unknown>): StaffContractTemplateRow {
  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    employment_type_id: r.employment_type_id as string,
    name: r.name as string,
    title: String(r.title ?? ""),
    sort_order: Number(r.sort_order ?? 0),
    is_active: r.is_active !== false,
  };
}

export async function loadStaffContractTemplates(
  restaurantId: string,
  employmentTypeId?: string | null,
): Promise<{ data: StaffContractTemplateRow[]; error: string | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: [], error: null };
  }
  const sb = createSupabaseBrowserClient();
  let q = sb
    .from("restaurant_staff_contract_templates")
    .select(
      "id, restaurant_id, employment_type_id, name, title, sort_order, is_active",
    )
    .eq("restaurant_id", restaurantId)
    .order("sort_order")
    .order("name");

  if (employmentTypeId) {
    q = q.eq("employment_type_id", employmentTypeId);
  }

  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => mapTemplateRow(r as Record<string, unknown>)),
    error: null,
  };
}

export async function loadStaffContractTemplateWithParagraphs(
  templateId: string,
): Promise<{ data: StaffContractTemplateWithParagraphs | null; error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { data: template, error: templateError } = await sb
    .from("restaurant_staff_contract_templates")
    .select(
      "id, restaurant_id, employment_type_id, name, title, sort_order, is_active",
    )
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) {
    return { data: null, error: templateError.message };
  }
  if (!template) {
    return { data: null, error: "not_found" };
  }

  const { data: paragraphs, error: paragraphError } = await sb
    .from("restaurant_staff_contract_template_paragraphs")
    .select("id, template_id, sort_order, heading, body")
    .eq("template_id", templateId)
    .order("sort_order");

  if (paragraphError) {
    return { data: null, error: paragraphError.message };
  }

  return {
    data: {
      ...mapTemplateRow(template as Record<string, unknown>),
      paragraphs: (paragraphs ?? []).map((r) =>
        mapParagraphRow(r as Record<string, unknown>),
      ),
    },
    error: null,
  };
}

export async function insertStaffContractTemplate(params: {
  restaurantId: string;
  employmentTypeId: string;
  name: string;
  title: string;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<{ id: string } | null> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.employmentTypeId)
  ) {
    return null;
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_staff_contract_templates")
    .insert({
      restaurant_id: params.restaurantId,
      employment_type_id: params.employmentTypeId,
      name: params.name.trim(),
      title: params.title.trim(),
      is_active: params.isActive !== false,
      sort_order: params.sortOrder ?? 0,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return { id: data.id as string };
}

export async function updateStaffContractTemplate(
  templateId: string,
  updates: {
    name?: string;
    title?: string;
    isActive?: boolean;
    sortOrder?: number;
  },
): Promise<boolean> {
  const sb = createSupabaseBrowserClient();
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name.trim();
  if (updates.title !== undefined) row.title = updates.title.trim();
  if (updates.isActive !== undefined) row.is_active = updates.isActive;
  if (updates.sortOrder !== undefined) row.sort_order = updates.sortOrder;
  if (Object.keys(row).length === 0) return true;

  const { error } = await sb
    .from("restaurant_staff_contract_templates")
    .update(row)
    .eq("id", templateId);

  return !error;
}

export async function deleteStaffContractTemplate(
  templateId: string,
): Promise<boolean> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("restaurant_staff_contract_templates")
    .delete()
    .eq("id", templateId);
  return !error;
}

export async function replaceStaffContractTemplateParagraphs(
  templateId: string,
  paragraphs: StaffContractTemplateDraftParagraph[],
): Promise<{ ok: boolean; error?: string }> {
  const sb = createSupabaseBrowserClient();
  const { error: deleteError } = await sb
    .from("restaurant_staff_contract_template_paragraphs")
    .delete()
    .eq("template_id", templateId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  const rows = paragraphs.map((p, index) => ({
    template_id: templateId,
    sort_order: index,
    heading: p.heading.trim() || null,
    body: p.body,
  }));

  if (rows.length === 0) {
    return { ok: true };
  }

  const { error: insertError } = await sb
    .from("restaurant_staff_contract_template_paragraphs")
    .insert(rows);

  if (insertError) {
    return { ok: false, error: insertError.message };
  }
  return { ok: true };
}

export async function reorderStaffContractTemplates(
  templateIds: string[],
): Promise<boolean> {
  const sb = createSupabaseBrowserClient();
  const results = await Promise.all(
    templateIds.map((id, index) =>
      sb
        .from("restaurant_staff_contract_templates")
        .update({ sort_order: index })
        .eq("id", id),
    ),
  );
  return results.every((r) => !r.error);
}

export async function saveStaffContractTemplateFull(params: {
  restaurantId: string;
  employmentTypeId: string;
  templateId?: string | null;
  name: string;
  title: string;
  isActive: boolean;
  paragraphs: StaffContractTemplateDraftParagraph[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const trimmedName = params.name.trim();
  if (!trimmedName) {
    return { ok: false, error: "Name fehlt." };
  }

  let templateId = params.templateId ?? null;

  if (templateId) {
    const updated = await updateStaffContractTemplate(templateId, {
      name: trimmedName,
      title: params.title,
      isActive: params.isActive,
    });
    if (!updated) {
      return { ok: false, error: "Mustervorlage konnte nicht gespeichert werden." };
    }
  } else {
    const { data: existing } = await loadStaffContractTemplates(
      params.restaurantId,
      params.employmentTypeId,
    );
    const inserted = await insertStaffContractTemplate({
      restaurantId: params.restaurantId,
      employmentTypeId: params.employmentTypeId,
      name: trimmedName,
      title: params.title,
      isActive: params.isActive,
      sortOrder: existing.length,
    });
    if (!inserted) {
      return { ok: false, error: "Mustervorlage konnte nicht angelegt werden." };
    }
    templateId = inserted.id;
  }

  const paragraphResult = await replaceStaffContractTemplateParagraphs(
    templateId,
    params.paragraphs,
  );
  if (!paragraphResult.ok) {
    return {
      ok: false,
      error: paragraphResult.error ?? "Paragraphen konnten nicht gespeichert werden.",
    };
  }

  return { ok: true, id: templateId };
}
