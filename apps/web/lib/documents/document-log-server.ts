import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DocumentLogAction,
  DocumentLogDetails,
} from "@/lib/types/document-log";

export async function snapshotDocumentLogActor(
  supabase: SupabaseClient,
  userId: string,
): Promise<Pick<DocumentLogDetails, "actorGivenName" | "actorFamilyName">> {
  const { data } = await supabase
    .from("profiles")
    .select("given_name, family_name")
    .eq("id", userId)
    .maybeSingle();
  return {
    actorGivenName: (data?.given_name as string | null) ?? "",
    actorFamilyName: (data?.family_name as string | null) ?? "",
  };
}

export async function resolveRestaurantEmployeeId(
  supabase: SupabaseClient,
  restaurantId: string,
  profileId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("restaurant_employees")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();
  return (data?.id as string | null) ?? null;
}

export async function insertRestaurantDocumentLog(
  supabase: SupabaseClient,
  params: {
    restaurantId: string;
    documentId: string | null;
    employeeId: string | null;
    actorUserId: string;
    action: DocumentLogAction;
    documentTitle: string;
    fileName?: string | null;
    details?: DocumentLogDetails;
  },
): Promise<void> {
  const actor = await snapshotDocumentLogActor(supabase, params.actorUserId);
  const details: DocumentLogDetails = {
    ...actor,
    ...params.details,
    actorGivenName: params.details?.actorGivenName ?? actor.actorGivenName,
    actorFamilyName: params.details?.actorFamilyName ?? actor.actorFamilyName,
  };

  const { error } = await supabase.from("restaurant_document_log_entries").insert({
    restaurant_id: params.restaurantId,
    document_id: params.documentId,
    employee_id: params.employeeId,
    actor_user_id: params.actorUserId,
    action: params.action,
    document_title: params.documentTitle.trim(),
    file_name: params.fileName?.trim() || null,
    details,
  });

  if (error) {
    console.warn("[gwada] restaurant_document_log_entries", error.message);
  }
}
