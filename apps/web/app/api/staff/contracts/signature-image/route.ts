import { RESTAURANT_DOCUMENTS_STORAGE_BUCKET } from "@/lib/constants/restaurant-documents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { StaffContractSignatureSnapshot } from "@/lib/types/staff-contract-templates";

export const dynamic = "force-dynamic";

async function canAccessContract(params: {
  restaurantId: string;
  contractId: string;
  userId: string;
}): Promise<boolean> {
  const userSb = await createSupabaseServerClient();
  const { data: staffPerm } = await userSb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: params.restaurantId,
    p_permission: "staff.read",
  });
  if (staffPerm) return true;

  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const { data: contract } = await admin
    .from("restaurant_staff_contracts")
    .select("staff_id")
    .eq("id", params.contractId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (!contract?.staff_id) return false;

  const { data: staffRow } = await admin
    .from("restaurant_staff")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("profile_id", params.userId)
    .maybeSingle();

  return staffRow?.id === contract.staff_id;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const contractId = url.searchParams.get("contractId")?.trim() ?? "";
  const roleRaw = url.searchParams.get("role")?.trim() ?? "";
  const storagePathParam = url.searchParams.get("storagePath")?.trim() ?? "";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(contractId) ||
    (roleRaw !== "employer" && roleRaw !== "employee" && !storagePathParam)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await canAccessContract({
    restaurantId,
    contractId,
    userId: user.id,
  });
  if (!allowed) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  let storagePath: string | null = null;

  if (storagePathParam) {
    const prefix = `${restaurantId}/staff-contracts/${contractId}/`;
    if (!storagePathParam.startsWith(prefix)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    storagePath = storagePathParam;
  } else {
    const { data: contract } = await admin
      .from("restaurant_staff_contracts")
      .select("signature_employer, signature_employee")
      .eq("id", contractId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (!contract) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const snapshot = (
      roleRaw === "employer"
        ? contract.signature_employer
        : contract.signature_employee
    ) as StaffContractSignatureSnapshot | null;

    storagePath = snapshot?.signature_storage_path?.trim() ?? null;
  }

  if (!storagePath) {
    return Response.json({ error: "no_signature" }, { status: 404 });
  }

  const { data: blob, error: dlError } = await admin.storage
    .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
    .download(storagePath);

  if (dlError || !blob) {
    return Response.json(
      { error: dlError?.message ?? "download_failed" },
      { status: 500 },
    );
  }

  return new Response(blob, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
