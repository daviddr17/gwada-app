import "server-only";

import JSZip from "jszip";
import { RESTAURANT_DOCUMENTS_STORAGE_BUCKET } from "@/lib/constants/restaurant-documents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listStaffDocumentsForEmployee } from "@/lib/staff/staff-documents-access-server";

export async function buildStaffDocumentsZipBuffer(params: {
  restaurantId: string;
  staffId: string;
  userId: string;
}): Promise<
  | { ok: true; buffer: Buffer; fileName: string }
  | { ok: false; error: string; status: number }
> {
  const list = await listStaffDocumentsForEmployee(params);
  if (!list.ok) {
    return { ok: false, error: list.error, status: list.status };
  }
  if (list.rows.length === 0) {
    return { ok: false, error: "no_documents", status: 404 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const zip = new JSZip();
  for (const doc of list.rows) {
    const { data, error } = await admin.storage
      .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
      .download(doc.storage_path);
    if (error || !data) continue;
    const bytes = new Uint8Array(await data.arrayBuffer());
    const safeName = doc.file_name.replace(/[/\\?%*:|"<>]/g, "_");
    zip.file(safeName, bytes);
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: "arraybuffer" }));
  return {
    ok: true,
    buffer,
    fileName: `mitarbeiter-dokumente-${params.staffId.slice(0, 8)}.zip`,
  };
}
