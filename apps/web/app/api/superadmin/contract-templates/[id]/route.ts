import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  bumpPlatformStaffContractTemplateVersion,
  deletePlatformStaffContractTemplate,
  fetchPlatformStaffContractTemplateWithParagraphs,
  savePlatformStaffContractTemplate,
} from "@/lib/supabase/platform-contract-templates-db";
import {
  PLATFORM_EMPLOYMENT_LEGACY_KEYS,
  type PlatformEmploymentLegacyKey,
  type PlatformStaffContractTemplateInput,
} from "@/lib/types/platform-contract-templates";

export const dynamic = "force-dynamic";

function parseLegacyKey(value: unknown): PlatformEmploymentLegacyKey | null {
  if (typeof value !== "string") return null;
  return PLATFORM_EMPLOYMENT_LEGACY_KEYS.includes(value as PlatformEmploymentLegacyKey)
    ? (value as PlatformEmploymentLegacyKey)
    : null;
}

function parseInput(body: unknown): PlatformStaffContractTemplateInput | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const countryCode =
    typeof o.countryCode === "string" ? o.countryCode.trim().toUpperCase() : "";
  const employmentLegacyKey = parseLegacyKey(o.employmentLegacyKey);
  const name = typeof o.name === "string" ? o.name : "";
  const title = typeof o.title === "string" ? o.title : "";
  const legalNotice =
    o.legalNotice === null || o.legalNotice === undefined
      ? null
      : typeof o.legalNotice === "string"
        ? o.legalNotice
        : null;
  const version = typeof o.version === "number" ? o.version : undefined;
  const sortOrder = typeof o.sortOrder === "number" ? o.sortOrder : undefined;
  const isActive = typeof o.isActive === "boolean" ? o.isActive : undefined;
  const paragraphs = Array.isArray(o.paragraphs)
    ? o.paragraphs
        .filter((p) => p && typeof p === "object")
        .map((p) => {
          const row = p as Record<string, unknown>;
          return {
            heading: typeof row.heading === "string" ? row.heading : "",
            body: typeof row.body === "string" ? row.body : "",
          };
        })
    : [];

  if (countryCode.length !== 2 || !employmentLegacyKey || !name.trim()) {
    return null;
  }

  return {
    countryCode,
    employmentLegacyKey,
    name,
    title,
    legalNotice,
    version,
    sortOrder,
    isActive,
    paragraphs,
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

  const { template, error } = await fetchPlatformStaffContractTemplateWithParagraphs(
    admin,
    id,
  );
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

  const { template, error } = await savePlatformStaffContractTemplate(admin, input, id);
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

  const { error } = await deletePlatformStaffContractTemplate(admin, id);
  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
