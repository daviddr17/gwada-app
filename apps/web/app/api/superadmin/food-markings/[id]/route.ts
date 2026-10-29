import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deletePlatformFoodMarking,
  fetchPlatformFoodMarking,
  savePlatformFoodMarking,
} from "@/lib/supabase/platform-food-markings-db";
import type { PlatformFoodMarkingInput } from "@/lib/types/platform-food-markings";
import type { FoodMarkingKind } from "@/lib/menu/food-marking-catalog";

export const dynamic = "force-dynamic";

function parseKind(value: unknown): FoodMarkingKind | null {
  if (value === "additive" || value === "allergen") return value;
  return null;
}

function parseInput(body: unknown): PlatformFoodMarkingInput | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const countryCode =
    typeof o.countryCode === "string" ? o.countryCode.trim().toUpperCase() : "";
  const code = typeof o.code === "string" ? o.code.trim() : "";
  const kind = parseKind(o.kind);
  const shortLabel =
    typeof o.shortLabel === "string" ? o.shortLabel.trim() : code;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  const sortOrder = typeof o.sortOrder === "number" ? o.sortOrder : undefined;
  const isActive = typeof o.isActive === "boolean" ? o.isActive : undefined;

  if (countryCode.length !== 2 || !code || !kind || !label) {
    return null;
  }

  return {
    countryCode,
    code,
    kind,
    shortLabel: shortLabel || code,
    label,
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

  const { marking, error } = await fetchPlatformFoodMarking(admin, id);
  if (error || !marking) {
    const status = error === "not_found" ? 404 : 500;
    return Response.json({ error: error ?? "not_found" }, { status });
  }

  return Response.json({ marking });
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const input = parseInput(await req.json().catch(() => null));
  if (!input) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { id } = await context.params;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { marking, error } = await savePlatformFoodMarking(admin, input, id);
  if (error || !marking) {
    const status =
      error === "not_found" ? 404 : error === "invalid_payload" ? 400 : 500;
    return Response.json({ error: error ?? "save_failed" }, { status });
  }

  return Response.json({ marking });
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

  const { error } = await deletePlatformFoodMarking(admin, id);
  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
