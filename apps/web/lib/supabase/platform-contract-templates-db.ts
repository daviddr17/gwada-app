import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PlatformEmploymentLegacyKey,
  PlatformStaffContractTemplate,
  PlatformStaffContractTemplateInput,
  PlatformStaffContractTemplateParagraph,
} from "@/lib/types/platform-contract-templates";

type TemplateRow = {
  id: string;
  country_code: string;
  employment_legacy_key: string;
  name: string;
  title: string;
  legal_notice: string | null;
  version: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ParagraphRow = {
  id: string;
  template_id: string;
  sort_order: number;
  heading: string | null;
  body: string;
};

const TEMPLATE_SELECT =
  "id, country_code, employment_legacy_key, name, title, legal_notice, version, sort_order, is_active, created_at, updated_at";

function mapTemplate(row: TemplateRow): PlatformStaffContractTemplate {
  return {
    id: row.id,
    countryCode: row.country_code,
    employmentLegacyKey: row.employment_legacy_key as PlatformEmploymentLegacyKey,
    name: row.name,
    title: row.title,
    legalNotice: row.legal_notice,
    version: row.version,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapParagraph(row: ParagraphRow): PlatformStaffContractTemplateParagraph {
  return {
    id: row.id,
    templateId: row.template_id,
    sortOrder: row.sort_order,
    heading: row.heading,
    body: row.body,
  };
}

export async function fetchPlatformStaffContractTemplates(
  client: SupabaseClient,
  params?: { countryCode?: string; activeOnly?: boolean },
): Promise<{ templates: PlatformStaffContractTemplate[]; error: string | null }> {
  let q = client
    .from("platform_staff_contract_templates")
    .select(TEMPLATE_SELECT)
    .order("country_code")
    .order("sort_order")
    .order("name");

  if (params?.countryCode) {
    q = q.eq("country_code", params.countryCode.toUpperCase());
  }
  if (params?.activeOnly !== false) {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) return { templates: [], error: error.message };
  return {
    templates: (data ?? []).map((row) => mapTemplate(row as TemplateRow)),
    error: null,
  };
}

export async function fetchPlatformStaffContractTemplateWithParagraphs(
  client: SupabaseClient,
  templateId: string,
): Promise<{ template: PlatformStaffContractTemplate | null; error: string | null }> {
  const { data: template, error: templateError } = await client
    .from("platform_staff_contract_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) return { template: null, error: templateError.message };
  if (!template) return { template: null, error: "not_found" };

  const { data: paragraphs, error: paragraphError } = await client
    .from("platform_staff_contract_template_paragraphs")
    .select("id, template_id, sort_order, heading, body")
    .eq("template_id", templateId)
    .order("sort_order");

  if (paragraphError) return { template: null, error: paragraphError.message };

  return {
    template: {
      ...mapTemplate(template as TemplateRow),
      paragraphs: (paragraphs ?? []).map((p) => mapParagraph(p as ParagraphRow)),
    },
    error: null,
  };
}

export async function savePlatformStaffContractTemplate(
  admin: SupabaseClient,
  input: PlatformStaffContractTemplateInput,
  templateId?: string | null,
): Promise<{ template: PlatformStaffContractTemplate | null; error: string | null }> {
  const name = input.name.trim();
  const title = input.title.trim();
  if (!name) return { template: null, error: "name_required" };

  const row = {
    country_code: input.countryCode.toUpperCase(),
    employment_legacy_key: input.employmentLegacyKey,
    name,
    title,
    legal_notice: input.legalNotice?.trim() || null,
    version: input.version ?? 1,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive !== false,
  };

  let id = templateId ?? null;

  if (id) {
    const { error } = await admin
      .from("platform_staff_contract_templates")
      .update(row)
      .eq("id", id);
    if (error) return { template: null, error: error.message };
  } else {
    const { data, error } = await admin
      .from("platform_staff_contract_templates")
      .insert(row)
      .select(TEMPLATE_SELECT)
      .single();
    if (error || !data) {
      return { template: null, error: error?.message ?? "insert_failed" };
    }
    id = (data as TemplateRow).id;
  }

  const { error: deleteError } = await admin
    .from("platform_staff_contract_template_paragraphs")
    .delete()
    .eq("template_id", id);

  if (deleteError) return { template: null, error: deleteError.message };

  const paragraphRows = input.paragraphs.map((p, index) => ({
    template_id: id,
    sort_order: index,
    heading: p.heading.trim() || null,
    body: p.body,
  }));

  if (paragraphRows.length > 0) {
    const { error: insertError } = await admin
      .from("platform_staff_contract_template_paragraphs")
      .insert(paragraphRows);
    if (insertError) return { template: null, error: insertError.message };
  }

  return fetchPlatformStaffContractTemplateWithParagraphs(admin, id!);
}

export async function deletePlatformStaffContractTemplate(
  admin: SupabaseClient,
  templateId: string,
): Promise<{ error: string | null }> {
  const { error } = await admin
    .from("platform_staff_contract_templates")
    .delete()
    .eq("id", templateId);
  return { error: error?.message ?? null };
}

export async function bumpPlatformStaffContractTemplateVersion(
  admin: SupabaseClient,
  templateId: string,
): Promise<{ error: string | null }> {
  const { data, error: readError } = await admin
    .from("platform_staff_contract_templates")
    .select("version")
    .eq("id", templateId)
    .maybeSingle();

  if (readError) return { error: readError.message };
  if (!data) return { error: "not_found" };

  const { error } = await admin
    .from("platform_staff_contract_templates")
    .update({ version: Number(data.version ?? 1) + 1 })
    .eq("id", templateId);

  return { error: error?.message ?? null };
}
