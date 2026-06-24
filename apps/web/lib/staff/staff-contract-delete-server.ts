import "server-only";

import { RESTAURANT_DOCUMENTS_STORAGE_BUCKET } from "@/lib/constants/restaurant-documents";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function collectSignatureStoragePath(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const path = (snapshot as { signature_storage_path?: unknown })
    .signature_storage_path;
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

export async function deleteStaffContractServer(params: {
  restaurantId: string;
  contractId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const { data: contract, error: fetchError } = await admin
    .from("restaurant_staff_contracts")
    .select("id, signature_employer, signature_employee")
    .eq("id", params.contractId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (fetchError) {
    console.error("[gwada] delete staff contract fetch", fetchError.message);
    return { ok: false, error: "fetch_failed", status: 500 };
  }
  if (!contract) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const { data: versionRows, error: versionsError } = await admin
    .from("restaurant_staff_contract_document_versions")
    .select("document_id")
    .eq("contract_id", params.contractId);

  if (versionsError) {
    console.error("[gwada] delete staff contract versions", versionsError.message);
    return { ok: false, error: "fetch_failed", status: 500 };
  }

  const documentIds = [
    ...new Set(
      (versionRows ?? [])
        .map((row) => row.document_id as string)
        .filter(Boolean),
    ),
  ];

  const storagePaths = new Set<string>();

  if (documentIds.length > 0) {
    const { data: docs, error: docsError } = await admin
      .from("restaurant_documents")
      .select("storage_path")
      .in("id", documentIds);

    if (docsError) {
      console.error("[gwada] delete staff contract documents", docsError.message);
      return { ok: false, error: "fetch_failed", status: 500 };
    }

    for (const doc of docs ?? []) {
      const path = doc.storage_path as string | null;
      if (path?.trim()) storagePaths.add(path.trim());
    }
  }

  const employerPath = collectSignatureStoragePath(contract.signature_employer);
  const employeePath = collectSignatureStoragePath(contract.signature_employee);
  if (employerPath) storagePaths.add(employerPath);
  if (employeePath) storagePaths.add(employeePath);

  const { error: logDeleteError } = await admin
    .from("restaurant_staff_contract_log_entries")
    .delete()
    .eq("contract_id", params.contractId);

  if (logDeleteError) {
    console.error("[gwada] delete staff contract log", logDeleteError.message);
    return { ok: false, error: "delete_failed", status: 500 };
  }

  const { error: versionsDeleteError } = await admin
    .from("restaurant_staff_contract_document_versions")
    .delete()
    .eq("contract_id", params.contractId);

  if (versionsDeleteError) {
    console.error(
      "[gwada] delete staff contract version rows",
      versionsDeleteError.message,
    );
    return { ok: false, error: "delete_failed", status: 500 };
  }

  if (documentIds.length > 0) {
    const { error: documentsDeleteError } = await admin
      .from("restaurant_documents")
      .delete()
      .in("id", documentIds);

    if (documentsDeleteError) {
      console.error(
        "[gwada] delete staff contract pdf documents",
        documentsDeleteError.message,
      );
      return { ok: false, error: "delete_failed", status: 500 };
    }
  }

  const { error: deleteError } = await admin
    .from("restaurant_staff_contracts")
    .delete()
    .eq("id", params.contractId)
    .eq("restaurant_id", params.restaurantId);

  if (deleteError) {
    console.error("[gwada] delete staff contract", deleteError.message);
    return { ok: false, error: "delete_failed", status: 500 };
  }

  if (storagePaths.size > 0) {
    const { error: storageError } = await admin.storage
      .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
      .remove([...storagePaths]);
    if (storageError) {
      console.warn("[gwada] delete staff contract storage", storageError.message);
    }
  }

  return { ok: true };
}

export async function handleDeleteStaffContractRequest(
  req: Request,
): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    contractId?: string;
  } | null;

  const restaurantId = body?.restaurantId?.trim() ?? "";
  const contractId = body?.contractId?.trim() ?? "";

  if (!restaurantId || !contractId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(restaurantId, "delete");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await deleteStaffContractServer({ restaurantId, contractId });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ ok: true });
}
