import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PlatformComplianceChecklistTemplate,
  PlatformComplianceChecklistTemplateInput,
} from "@/lib/types/platform-compliance-templates";
import type {
  ComplianceCategory,
  ComplianceChecklistItem,
  ComplianceFrequency,
} from "@/lib/types/compliance";

type TemplateRow = {
  id: string;
  country_code: string;
  name: string;
  description: string | null;
  category: string;
  frequency: string;
  items: ComplianceChecklistItem[] | null;
  show_on_display: boolean;
  version: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const TEMPLATE_SELECT =
  "id, country_code, name, description, category, frequency, items, show_on_display, version, sort_order, is_active, created_at, updated_at";

function mapTemplate(row: TemplateRow): PlatformComplianceChecklistTemplate {
  return {
    id: row.id,
    countryCode: row.country_code,
    name: row.name,
    description: row.description,
    category: row.category as ComplianceCategory,
    frequency: row.frequency as ComplianceFrequency,
    items: Array.isArray(row.items) ? row.items : [],
    showOnDisplay: row.show_on_display,
    version: row.version,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPlatformComplianceChecklistTemplates(
  client: SupabaseClient,
  params?: { countryCode?: string; activeOnly?: boolean },
): Promise<{ templates: PlatformComplianceChecklistTemplate[]; error: string | null }> {
  let q = client
    .from("platform_compliance_checklist_templates")
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

export async function fetchPlatformComplianceChecklistTemplate(
  client: SupabaseClient,
  templateId: string,
): Promise<{ template: PlatformComplianceChecklistTemplate | null; error: string | null }> {
  const { data, error } = await client
    .from("platform_compliance_checklist_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .maybeSingle();

  if (error) return { template: null, error: error.message };
  if (!data) return { template: null, error: "not_found" };
  return { template: mapTemplate(data as TemplateRow), error: null };
}

export async function savePlatformComplianceChecklistTemplate(
  client: SupabaseClient,
  input: PlatformComplianceChecklistTemplateInput,
  templateId?: string | null,
): Promise<{ template: PlatformComplianceChecklistTemplate | null; error: string | null }> {
  const payload = {
    country_code: input.countryCode.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    frequency: input.frequency,
    items: input.items,
    show_on_display: input.showOnDisplay ?? true,
    version: input.version ?? 1,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  };

  if (templateId) {
    const { data, error } = await client
      .from("platform_compliance_checklist_templates")
      .update(payload)
      .eq("id", templateId)
      .select(TEMPLATE_SELECT)
      .single();
    if (error) return { template: null, error: error.message };
    return { template: mapTemplate(data as TemplateRow), error: null };
  }

  const { data, error } = await client
    .from("platform_compliance_checklist_templates")
    .insert(payload)
    .select(TEMPLATE_SELECT)
    .single();
  if (error) return { template: null, error: error.message };
  return { template: mapTemplate(data as TemplateRow), error: null };
}

export async function deletePlatformComplianceChecklistTemplate(
  client: SupabaseClient,
  templateId: string,
): Promise<{ error: string | null }> {
  const { error } = await client
    .from("platform_compliance_checklist_templates")
    .delete()
    .eq("id", templateId);
  return { error: error?.message ?? null };
}

export async function bumpPlatformComplianceChecklistTemplateVersion(
  client: SupabaseClient,
  templateId: string,
): Promise<{ error: string | null }> {
  const { data, error: loadError } = await client
    .from("platform_compliance_checklist_templates")
    .select("version")
    .eq("id", templateId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!data) return { error: "not_found" };

  const nextVersion = Number((data as { version: number }).version) + 1;
  const { error } = await client
    .from("platform_compliance_checklist_templates")
    .update({ version: nextVersion })
    .eq("id", templateId);
  return { error: error?.message ?? null };
}
