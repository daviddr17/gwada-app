import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffInviteChannel } from "@/lib/types/staff";

const INVITE_TTL_DAYS = 14;

export function generateStaffInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashStaffInviteToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function staffInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/einladung/${encodeURIComponent(token)}`;
}

export async function createStaffInvite(
  supabase: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    restaurantPositionId: string;
    channel: StaffInviteChannel;
    createdBy: string;
  },
): Promise<{ token: string; inviteId: string } | null> {
  const token = generateStaffInviteToken();
  const tokenHash = hashStaffInviteToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  await supabase
    .from("restaurant_staff_invites")
    .update({ status: "revoked" })
    .eq("staff_id", params.staffId)
    .eq("status", "pending");

  const { data, error } = await supabase
    .from("restaurant_staff_invites")
    .insert({
      restaurant_id: params.restaurantId,
      staff_id: params.staffId,
      token_hash: tokenHash,
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
