import type { StaffInviteContactConflictResult } from "@/lib/staff/staff-invite-contact-conflict-types";

export type StaffInviteAction = "copy" | "whatsapp" | "email";

export async function fetchStaffInviteContactCheckClient(params: {
  restaurantId: string;
  staffId: string;
  email?: string | null;
  phone?: string | null;
  signal?: AbortSignal;
}): Promise<{
  data?: StaffInviteContactConflictResult;
  error?: string;
}> {
  const qs = new URLSearchParams({
    restaurantId: params.restaurantId,
    staffId: params.staffId,
  });
  if (params.email?.trim()) qs.set("email", params.email.trim());
  if (params.phone?.trim()) qs.set("phone", params.phone.trim());

  const res = await fetch(`/api/staff/invite/contact-check?${qs.toString()}`, {
    signal: params.signal,
  });
  const body = (await res.json().catch(() => ({}))) as
    | StaffInviteContactConflictResult
    | { error?: string };
  if (!res.ok) {
    return { error: "error" in body ? (body.error ?? `check_${res.status}`) : `check_${res.status}` };
  }
  return { data: body as StaffInviteContactConflictResult };
}

export async function sendStaffInviteClient(params: {
  restaurantId: string;
  staffId: string;
  restaurantPositionId: string;
  action: StaffInviteAction;
}): Promise<{
  inviteUrl?: string;
  sent?: boolean;
  error?: string;
  conflictLabel?: string;
  conflictStaffName?: string | null;
}> {
  const res = await fetch("/api/staff/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = (await res.json().catch(() => ({}))) as {
    inviteUrl?: string;
    sent?: boolean;
    error?: string;
    label?: string;
    staffName?: string | null;
  };
  if (!res.ok) {
    return {
      error: body.error ?? `invite_${res.status}`,
      conflictLabel: body.label,
      conflictStaffName: body.staffName ?? null,
    };
  }
  return {
    inviteUrl: body.inviteUrl,
    sent: body.sent,
  };
}

export async function uploadStaffAvatarClient(params: {
  restaurantId: string;
  staffId: string;
  file: File;
}): Promise<{ error?: string }> {
  const form = new FormData();
  form.set("restaurantId", params.restaurantId);
  form.set("staffId", params.staffId);
  form.set("file", params.file);
  const res = await fetch("/api/staff/avatar", { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { error: body.error ?? `avatar_${res.status}` };
  return {};
}

export async function revokeStaffRestaurantAccessClient(params: {
  restaurantId: string;
  staffId?: string;
  employeeId?: string;
}): Promise<{ profileLabel?: string; error?: string }> {
  const res = await fetch("/api/team/revoke-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = (await res.json().catch(() => ({}))) as {
    profileLabel?: string;
    error?: string;
  };
  if (!res.ok) return { error: body.error ?? `revoke_${res.status}` };
  return { profileLabel: body.profileLabel };
}
