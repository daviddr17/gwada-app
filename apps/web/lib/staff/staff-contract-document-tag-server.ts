import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { STAFF_CONTRACT_DEFAULT_DOCUMENT_TAG_NAME } from "@/lib/supabase/staff-module-settings-db";

export async function resolveStaffContractDocumentTagIdServer(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ tagId: string | null; error: string | null }> {
  const { data: settings } = await admin
    .from("restaurant_staff_module_settings")
    .select("contract_document_tag_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (settings?.contract_document_tag_id) {
    return { tagId: settings.contract_document_tag_id as string, error: null };
  }

  const { data: existingTag } = await admin
    .from("restaurant_document_tags")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .ilike("name", STAFF_CONTRACT_DEFAULT_DOCUMENT_TAG_NAME)
    .maybeSingle();

  if (existingTag?.id) {
    const tagId = existingTag.id as string;
    await admin.from("restaurant_staff_module_settings").upsert(
      {
        restaurant_id: restaurantId,
        contract_document_tag_id: tagId,
      },
      { onConflict: "restaurant_id" },
    );
    return { tagId, error: null };
  }

  const { data: created, error: createError } = await admin
    .from("restaurant_document_tags")
    .insert({
      restaurant_id: restaurantId,
      name: STAFF_CONTRACT_DEFAULT_DOCUMENT_TAG_NAME,
      is_active: true,
      background_color: "#64748b",
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    return {
      tagId: null,
      error: createError?.message ?? "Dokument-Tag konnte nicht angelegt werden.",
    };
  }

  const tagId = created.id as string;
  await admin.from("restaurant_staff_module_settings").upsert(
    {
      restaurant_id: restaurantId,
      contract_document_tag_id: tagId,
    },
    { onConflict: "restaurant_id" },
  );

  return { tagId, error: null };
}
