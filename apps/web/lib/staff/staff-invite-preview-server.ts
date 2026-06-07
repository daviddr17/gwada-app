import "server-only";

import {
  generateStaffInviteToken,
  hashStaffInviteToken,
} from "@/lib/staff/staff-invite-server";
import type { StaffInviteChannel } from "@/lib/types/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffInvitePreview = {
  invite_id: string;
  restaurant_id: string;
  staff_id: string;
  restaurant_name: string;
  staff_given_name: string;
  staff_family_name: string;
  staff_email: string | null;
  position_name: string;
};

export type StaffInvitePreviewError =
  | "invalid"
  | "not_found"
  | "revoked"
  | "expired"
  | "accepted";

export function normalizeStaffInviteToken(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function explainStaffInviteToken(
  admin: SupabaseClient,
  token: string,
): Promise<{ status: StaffInvitePreviewError | "pending" }> {
  const normalized = normalizeStaffInviteToken(token);
  const { data, error } = await admin.rpc("explain_staff_invite_by_token", {
    p_token: normalized,
  });
  if (error) {
    console.warn("[gwada] explain_staff_invite_by_token", error.message);
    return { status: "not_found" };
  }
  const status = (data as { status?: string } | null)?.status ?? "not_found";
  if (
    status === "pending" ||
    status === "revoked" ||
    status === "expired" ||
    status === "accepted" ||
    status === "invalid" ||
    status === "not_found"
  ) {
    return { status };
  }
  return { status: "not_found" };
}

export async function resolveStaffInvitePreview(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { ok: true; invite: StaffInvitePreview }
  | { ok: false; error: StaffInvitePreviewError }
> {
  const normalized = normalizeStaffInviteToken(token);
  if (normalized.length < 16) {
    return { ok: false, error: "invalid" };
  }

  const explained = await explainStaffInviteToken(admin, normalized);
  if (explained.status !== "pending") {
    return { ok: false, error: explained.status };
  }

  const { data, error } = await admin.rpc("resolve_staff_invite_by_token", {
    p_token: normalized,
  });

  if (error) {
    console.warn("[gwada] resolve_staff_invite_by_token", error.message);
    return { ok: false, error: "not_found" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: false, error: "not_found" };
  }

  return {
    ok: true,
    invite: {
      invite_id: row.invite_id as string,
      restaurant_id: row.restaurant_id as string,
      staff_id: row.staff_id as string,
      restaurant_name: row.restaurant_name as string,
      staff_given_name: row.staff_given_name as string,
      staff_family_name: row.staff_family_name as string,
      staff_email: (row.staff_email as string | null) ?? null,
      position_name: row.position_name as string,
    },
  };
}

export async function createStaffInviteAdmin(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    restaurantPositionId: string;
    channel: StaffInviteChannel;
    createdBy: string;
  },
): Promise<{ token: string; inviteId: string } | null> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);
  const nowIso = new Date().toISOString();

  const { data: existing } = await admin
    .from("restaurant_staff_invites")
    .select("id, invite_token")
    .eq("staff_id", params.staffId)
    .eq("status", "pending")
    .eq("restaurant_position_id", params.restaurantPositionId)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (existing?.invite_token) {
    const { error } = await admin
      .from("restaurant_staff_invites")
      .update({
        channel: params.channel,
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", existing.id);
    if (error) return null;
    return {
      token: existing.invite_token as string,
      inviteId: existing.id as string,
    };
  }

  await admin
    .from("restaurant_staff_invites")
    .update({ status: "revoked" })
    .eq("staff_id", params.staffId)
    .eq("status", "pending");

  const token = generateStaffInviteToken();
  const tokenHash = hashStaffInviteToken(token);

  const { data, error } = await admin
    .from("restaurant_staff_invites")
    .insert({
      restaurant_id: params.restaurantId,
      staff_id: params.staffId,
      token_hash: tokenHash,
      invite_token: token,
      channel: params.channel,
      restaurant_position_id: params.restaurantPositionId,
      expires_at: expiresAt.toISOString(),
      created_by: params.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return { token, inviteId: data.id as string };
}

export type StaffInviteViewerStatus = import("@/lib/types/staff").StaffInviteViewerStatus;

export async function resolveStaffInviteViewerStatus(
  admin: SupabaseClient,
  invite: StaffInvitePreview,
  viewerUserId: string | null,
): Promise<StaffInviteViewerStatus> {
  const { data: staffRow } = await admin
    .from("restaurant_staff")
    .select("profile_id")
    .eq("id", invite.staff_id)
    .maybeSingle();

  const linkedProfileId = (staffRow?.profile_id as string | null) ?? null;

  if (linkedProfileId) {
    if (!viewerUserId) return "staff_linked_other";
    if (viewerUserId === linkedProfileId) return "already_member";
    return "wrong_account";
  }

  if (!viewerUserId) return "anonymous";

  const { data: emp } = await admin
    .from("restaurant_employees")
    .select("is_active, staff_id")
    .eq("restaurant_id", invite.restaurant_id)
    .eq("profile_id", viewerUserId)
    .maybeSingle();

  if (emp?.is_active) {
    return "already_member";
  }

  return "can_join";
}

export async function getStaffInviteAdminClient(): Promise<SupabaseClient | null> {
  return createSupabaseAdminClient();
}
