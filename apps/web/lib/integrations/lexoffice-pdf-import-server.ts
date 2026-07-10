import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RESTAURANT_DOCUMENTS_QUOTA_BYTES } from "@/lib/constants/restaurant-documents";
import { RESTAURANT_DOCUMENTS_STORAGE_BUCKET } from "@/lib/constants/restaurant-documents";
import { buildRestaurantDocumentStoragePath } from "@/lib/supabase/documents-db";
import { fetchLexofficeSalesDocumentFile } from "@/lib/integrations/lexoffice-voucherlist";
import { fetchRestaurantLexofficeApiKey } from "@/lib/supabase/restaurant-lexoffice-integration-db";

export type LexofficePdfImportResourceType =
  | "invoice"
  | "quotation"
  | "voucher";

export async function fetchLexofficeDocumentImportId(
  admin: SupabaseClient,
  restaurantId: string,
  resourceType: LexofficePdfImportResourceType,
  resourceId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("restaurant_lexoffice_document_imports")
    .select("document_id")
    .eq("restaurant_id", restaurantId)
    .eq("lexoffice_resource_type", resourceType)
    .eq("lexoffice_resource_id", resourceId)
    .maybeSingle();
  return (data as { document_id: string | null } | null)?.document_id ?? null;
}

async function fetchLexofficeVoucherPdfBytes(
  restaurantId: string,
  externalId: string,
): Promise<{ ok: true; bytes: Uint8Array; fileName: string } | { ok: false; error: string }> {
  const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
  if (!apiKey) return { ok: false, error: "Lexware nicht verbunden." };

  let res: Response;
  try {
    res = await fetch(
      `https://api.lexware.io/v1/vouchers/${externalId}/files`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
  } catch {
    return { ok: false, error: "Lexware API nicht erreichbar." };
  }

  if (!res.ok) {
    return { ok: false, error: `Lexware Beleg (${res.status})` };
  }

  const meta = (await res.json()) as {
    files?: { fileId?: string; fileName?: string }[];
  };
  const first = meta.files?.[0];
  if (!first?.fileId) {
    return { ok: false, error: "Keine Datei am Beleg." };
  }

  let fileRes: Response;
  try {
    fileRes = await fetch(`https://api.lexware.io/v1/files/${first.fileId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/pdf" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Lexware Datei nicht erreichbar." };
  }

  if (!fileRes.ok) {
    return { ok: false, error: `Lexware PDF (${fileRes.status})` };
  }

  const buf = new Uint8Array(await fileRes.arrayBuffer());
  return {
    ok: true,
    bytes: buf,
    fileName: first.fileName?.trim() || `beleg-${externalId.slice(0, 8)}.pdf`,
  };
}

export async function importLexofficePdfToDocuments(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    resourceType: LexofficePdfImportResourceType;
    resourceId: string;
    title: string;
    voucherNumber?: string | null;
    lexofficeVoucherType?: string;
  },
): Promise<
  | { ok: true; documentId: string; skipped: boolean }
  | { ok: false; error: string }
> {
  const existingId = await fetchLexofficeDocumentImportId(
    admin,
    params.restaurantId,
    params.resourceType,
    params.resourceId,
  );
  if (existingId) {
    return { ok: true, documentId: existingId, skipped: true };
  }

  let pdf:
    | { ok: true; bytes: Uint8Array; fileName: string }
    | { ok: false; error: string };

  if (params.resourceType === "voucher") {
    pdf = await fetchLexofficeVoucherPdfBytes(
      params.restaurantId,
      params.resourceId,
    );
  } else {
    const file = await fetchLexofficeSalesDocumentFile(
      params.restaurantId,
      params.resourceType,
      params.resourceId,
      "pdf",
    );
    if (!file.ok) return file;
    pdf = {
      ok: true,
      bytes: new Uint8Array(file.buffer),
      fileName: file.filename,
    };
  }

  if (!pdf.ok) return pdf;

  const { data: usedRaw, error: usageError } = await admin.rpc(
    "restaurant_workspace_used_bytes",
    { p_restaurant_id: params.restaurantId },
  );
  if (usageError) return { ok: false, error: usageError.message };
  const used = Number(usedRaw ?? 0);
  if (used + pdf.bytes.byteLength > RESTAURANT_DOCUMENTS_QUOTA_BYTES) {
    return { ok: false, error: "Speicherquota überschritten." };
  }

  const documentId = randomUUID();
  const fileName = pdf.fileName.endsWith(".pdf")
    ? pdf.fileName
    : `${pdf.fileName}.pdf`;
  const storagePath = buildRestaurantDocumentStoragePath({
    restaurantId: params.restaurantId,
    documentId,
    fileName,
  });

  const { error: uploadError } = await admin.storage
    .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
    .upload(storagePath, pdf.bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const title = params.title.trim() || fileName.replace(/\.pdf$/i, "");
  const { error: insertError } = await admin.from("restaurant_documents").insert({
    id: documentId,
    restaurant_id: params.restaurantId,
    title,
    file_name: fileName,
    storage_path: storagePath,
    mime_type: "application/pdf",
    size_bytes: pdf.bytes.byteLength,
    uploaded_by: null,
  });
  if (insertError) {
    await admin.storage
      .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
    return { ok: false, error: insertError.message };
  }

  const { error: linkError } = await admin
    .from("restaurant_lexoffice_document_imports")
    .insert({
      restaurant_id: params.restaurantId,
      lexoffice_resource_type: params.resourceType,
      lexoffice_resource_id: params.resourceId,
      document_id: documentId,
    });
  if (linkError) {
    console.warn("[lexoffice] document import link", linkError.message);
  }

  return { ok: true, documentId, skipped: false };
}
