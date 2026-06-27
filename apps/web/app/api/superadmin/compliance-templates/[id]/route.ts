import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deletePlatformComplianceChecklistTemplate,
  fetchPlatformComplianceChecklistTemplate,
  savePlatformComplianceChecklistTemplate,
} from "@/lib/supabase/platform-compliance-templates-db";
import {
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_FREQUENCIES,
  type ComplianceCategory,
  type ComplianceChecklistItem,
  type ComplianceFrequency,
} from "@/lib/types/compliance";
import type { PlatformComplianceChecklistTemplateInput } from "@/lib/types/platform-compliance-templates";

export const dynamic = "force-dynamic";

function parseCategory(value: unknown): ComplianceCategory | null {
  if (typeof value !== "string") return null;
  return COMPLIANCE_CATEGORIES.includes(value as ComplianceCategory)
    ? (value as ComplianceCategory)
    : null;
}

function parseFrequency(value: unknown): ComplianceFrequency | null {
  if (typeof value !== "string") return null;
  return COMPLIANCE_FREQUENCIES.includes(value as ComplianceFrequency)
    ? (value as ComplianceFrequency)
    : null;
}

function parseItems(value: unknown): ComplianceChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as ComplianceChecklistItem[];
}

function parseInput(body: unknown): PlatformComplianceChecklistTemplateInput | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const countryCode =
    typeof o.countryCode === "string" ? o.countryCode.trim().toUpperCase() : "";
  const name = typeof o.name === "string" ? o.name : "";
  const description =
    o.description === null || o.description === undefined
      ? null
      : typeof o.description === "string"
        ? o.description
        : null;
  const category = parseCategory(o.category);
  const frequency = parseFrequency(o.frequency);
  const items = parseItems(o.items);
  const version = typeof o.version === "number" ? o.version : undefined;
  const sortOrder = typeof o.sortOrder === "number" ? o.sortOrder : undefined;
  const isActive = typeof o.isActive === "boolean" ? o.isActive : undefined;
  const showOnDisplay =
    typeof o.showOnDisplay === "boolean" ? o.showOnDisplay : undefined;

  if (countryCode.length !== 2 || !name.trim() || !category || !frequency) {
    return null;
  }

  return {
    countryCode,
    name,
    description,
    category,
    frequency,
    items,
    showOnDisplay,
    version,
    sortOrder,
    isActive,
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { template, error } = await fetchPlatformComplianceChecklistTemplate(admin, id);
  if (error === "not_found") {
    return Response.json({ error }, { status: 404 });
  }
  if (error || !template) {
    return Response.json({ error: error ?? "load_failed" }, { status: 500 });
  }

  return Response.json({ template });
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const input = parseInput(await req.json().catch(() => null));
  if (!input) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { template, error } = await savePlatformComplianceChecklistTemplate(admin, input, id);
  if (error || !template) {
    return Response.json({ error: error ?? "save_failed" }, { status: 500 });
  }

  return Response.json({ template });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { error } = await deletePlatformComplianceChecklistTemplate(admin, id);
  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
