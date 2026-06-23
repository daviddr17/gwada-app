import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StaffContractBodySnapshot } from "@/lib/types/staff-contract-templates";

export type PendingStaffContractItem = {
  id: string;
  title: string;
  createdAt: string;
  employerSignedAt: string | null;
  bodySnapshot: StaffContractBodySnapshot | null;
};

export async function listPendingStaffContractsForProfile(
  restaurantId: string,
  userId: string,
): Promise<
  | { ok: true; items: PendingStaffContractItem[] }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const { data: staffRow } = await admin
    .from("restaurant_staff")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!staffRow?.id) {
    return { ok: true, items: [] };
  }

  const { data, error } = await admin
    .from("restaurant_staff_contracts")
    .select(
      "id, created_at, contract_body_snapshot, signature_employer, employee_signature_pending",
    )
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffRow.id)
    .eq("employee_signature_pending", true)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  const items: PendingStaffContractItem[] = (data ?? []).map((row) => {
    const snapshot = row.contract_body_snapshot as StaffContractBodySnapshot | null;
    const employer = row.signature_employer as { signed_at?: string } | null;
    const fallbackTitle = "Arbeitsvertrag";
    return {
      id: row.id as string,
      title: snapshot?.title?.trim() || fallbackTitle,
      createdAt: row.created_at as string,
      employerSignedAt: employer?.signed_at ?? null,
      bodySnapshot: snapshot,
    };
  });

  return { ok: true, items };
}

export async function handlePendingStaffContractsRequest(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim();
  if (!restaurantId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await listPendingStaffContractsForProfile(
    restaurantId,
    user.id,
  );
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ items: result.items });
}
