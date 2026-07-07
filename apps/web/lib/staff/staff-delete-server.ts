import "server-only";

import { RESTAURANT_DOCUMENTS_STORAGE_BUCKET } from "@/lib/constants/restaurant-documents";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { deleteStaffContractServer } from "@/lib/staff/staff-contract-delete-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const STAFF_AVATARS_BUCKET = "restaurant-staff-avatars";

type EmployeeSnapshot = {
  id: string;
  role: string;
  is_active: boolean;
};

async function countActiveOwners(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const { count } = await admin
    .from("restaurant_employees")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("role", "owner")
    .eq("is_active", true);
  return count ?? 0;
}

export async function deleteStaffServer(params: {
  restaurantId: string;
  staffId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const { data: staff, error: staffError } = await admin
    .from("restaurant_staff")
    .select("id, profile_id, employee_id, avatar_storage_path")
    .eq("id", params.staffId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (staffError) {
    console.error("[gwada] delete staff fetch", staffError.message);
    return { ok: false, error: "fetch_failed", status: 500 };
  }
  if (!staff) {
    return { ok: false, error: "not_found", status: 404 };
  }

  if (staff.profile_id === params.actorUserId) {
    return { ok: false, error: "cannot_delete_self", status: 409 };
  }

  let employee: EmployeeSnapshot | null = null;

  if (staff.employee_id) {
    const { data: emp } = await admin
      .from("restaurant_employees")
      .select("id, role, is_active")
      .eq("id", staff.employee_id)
      .maybeSingle();
    employee = (emp as EmployeeSnapshot | null) ?? null;
  } else if (staff.profile_id) {
    const { data: emp } = await admin
      .from("restaurant_employees")
      .select("id, role, is_active")
      .eq("restaurant_id", params.restaurantId)
      .eq("profile_id", staff.profile_id)
      .maybeSingle();
    employee = (emp as EmployeeSnapshot | null) ?? null;
  }

  if (
    employee?.role === "owner" &&
    employee.is_active &&
    (await countActiveOwners(admin, params.restaurantId)) <= 1
  ) {
    return { ok: false, error: "last_owner", status: 409 };
  }

  const { data: contractRows, error: contractsError } = await admin
    .from("restaurant_staff_contracts")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("staff_id", params.staffId);

  if (contractsError) {
    console.error("[gwada] delete staff contracts list", contractsError.message);
    return { ok: false, error: "fetch_failed", status: 500 };
  }

  for (const row of contractRows ?? []) {
    const result = await deleteStaffContractServer({
      restaurantId: params.restaurantId,
      contractId: row.id as string,
    });
    if (!result.ok) {
      return { ok: false, error: result.error, status: result.status };
    }
  }

  const { data: staffDocs, error: docsError } = await admin
    .from("restaurant_documents")
    .select("id, storage_path")
    .eq("restaurant_id", params.restaurantId)
    .eq("staff_id", params.staffId);

  if (docsError) {
    console.error("[gwada] delete staff documents list", docsError.message);
    return { ok: false, error: "fetch_failed", status: 500 };
  }

  const docPaths = (staffDocs ?? [])
    .map((row) => (row.storage_path as string | null)?.trim())
    .filter((path): path is string => Boolean(path));

  if ((staffDocs ?? []).length > 0) {
    const { error: deleteDocsError } = await admin
      .from("restaurant_documents")
      .delete()
      .eq("restaurant_id", params.restaurantId)
      .eq("staff_id", params.staffId);

    if (deleteDocsError) {
      console.error("[gwada] delete staff documents", deleteDocsError.message);
      return { ok: false, error: "delete_failed", status: 500 };
    }
  }

  const storagePaths = [...docPaths];
  const avatarPath = (staff.avatar_storage_path as string | null)?.trim();
  if (avatarPath) storagePaths.push(avatarPath);

  if (employee?.is_active) {
    const { error: employeeError } = await admin
      .from("restaurant_employees")
      .update({ is_active: false })
      .eq("id", employee.id);
    if (employeeError) {
      console.error("[gwada] delete staff deactivate employee", employeeError.message);
      return { ok: false, error: "delete_failed", status: 500 };
    }
  }

  await admin
    .from("restaurant_staff_invites")
    .update({ status: "revoked" })
    .eq("staff_id", params.staffId)
    .eq("status", "pending");

  const { error: deleteError } = await admin
    .from("restaurant_staff")
    .delete()
    .eq("id", params.staffId)
    .eq("restaurant_id", params.restaurantId);

  if (deleteError) {
    console.error("[gwada] delete staff row", deleteError.message);
    return { ok: false, error: "delete_failed", status: 500 };
  }

  if (storagePaths.length > 0) {
    const { error: docsStorageError } = await admin.storage
      .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
      .remove(docPaths);
    if (docsStorageError) {
      console.warn("[gwada] delete staff document storage", docsStorageError.message);
    }
    if (avatarPath) {
      const { error: avatarStorageError } = await admin.storage
        .from(STAFF_AVATARS_BUCKET)
        .remove([avatarPath]);
      if (avatarStorageError) {
        console.warn("[gwada] delete staff avatar storage", avatarStorageError.message);
      }
    }
  }

  return { ok: true };
}

export async function handleDeleteStaffRequest(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    staffId?: string;
  } | null;

  const restaurantId = body?.restaurantId?.trim() ?? "";
  const staffId = body?.staffId?.trim() ?? "";

  if (!restaurantId || !staffId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(restaurantId, "delete");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await deleteStaffServer({
    restaurantId,
    staffId,
    actorUserId: auth.userId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true });
}
