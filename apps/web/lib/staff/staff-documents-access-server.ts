import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

const DOCUMENT_ACCESS_SELECT =
  "id, restaurant_id, tag_id, staff_id, title, file_name, storage_path, mime_type, size_bytes, created_at";

export type StaffDocumentAccessRow = {
  id: string;
  restaurant_id: string;
  tag_id: string | null;
  staff_id: string | null;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

async function hasDocumentsManage(
  userSb: SupabaseClient,
  restaurantId: string,
): Promise<boolean> {
  const { data } = await userSb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "documents.manage",
  });
  return Boolean(data);
}

async function hasStaffRead(
  userSb: SupabaseClient,
  restaurantId: string,
): Promise<boolean> {
  const { data } = await userSb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "staff.read",
  });
  return Boolean(data);
}

async function resolveLinkedStaffId(
  admin: SupabaseClient,
  restaurantId: string,
  profileId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("restaurant_staff")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data?.id as string | null) ?? null;
}

export async function assertCanAccessStaffDocument(params: {
  restaurantId: string;
  documentId: string;
  userId: string;
}): Promise<
  | { ok: true; row: StaffDocumentAccessRow }
  | { ok: false; error: string; status: number }
> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.documentId)
  ) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const userSb = await createSupabaseServerClient();
  const { data: row, error } = await admin
    .from("restaurant_documents")
    .select(DOCUMENT_ACCESS_SELECT)
    .eq("id", params.documentId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }
  if (!row?.id) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const doc = row as StaffDocumentAccessRow;

  if (await hasDocumentsManage(userSb, params.restaurantId)) {
    return { ok: true, row: doc };
  }

  if (doc.staff_id && (await hasStaffRead(userSb, params.restaurantId))) {
    return { ok: true, row: doc };
  }

  if (doc.staff_id) {
    const linkedStaffId = await resolveLinkedStaffId(
      admin,
      params.restaurantId,
      params.userId,
    );
    if (linkedStaffId && linkedStaffId === doc.staff_id) {
      return { ok: true, row: doc };
    }
  }

  return { ok: false, error: "forbidden", status: 403 };
}

export async function listStaffDocumentsForEmployee(params: {
  restaurantId: string;
  staffId: string;
  userId: string;
}): Promise<
  | { ok: true; rows: StaffDocumentAccessRow[] }
  | { ok: false; error: string; status: number }
> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.staffId)
  ) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const userSb = await createSupabaseServerClient();
  const canHr =
    (await hasDocumentsManage(userSb, params.restaurantId)) ||
    (await hasStaffRead(userSb, params.restaurantId));

  if (!canHr) {
    const linkedStaffId = await resolveLinkedStaffId(
      admin,
      params.restaurantId,
      params.userId,
    );
    if (!linkedStaffId || linkedStaffId !== params.staffId) {
      return { ok: false, error: "forbidden", status: 403 };
    }
  }

  const { data, error } = await admin
    .from("restaurant_documents")
    .select(DOCUMENT_ACCESS_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("staff_id", params.staffId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  return { ok: true, rows: (data ?? []) as StaffDocumentAccessRow[] };
}

export async function listMyStaffDocuments(params: {
  restaurantId: string;
  userId: string;
}): Promise<
  | { ok: true; rows: StaffDocumentAccessRow[]; staffId: string }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const staffId = await resolveLinkedStaffId(
    admin,
    params.restaurantId,
    params.userId,
  );
  if (!staffId) {
    return { ok: false, error: "no_staff_profile", status: 404 };
  }

  const { data, error } = await admin
    .from("restaurant_documents")
    .select(DOCUMENT_ACCESS_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  return {
    ok: true,
    staffId,
    rows: (data ?? []) as StaffDocumentAccessRow[],
  };
}
