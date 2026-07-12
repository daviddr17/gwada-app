"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  invalidateWorkspaceRestaurantCache,
  notifyWorkspaceRestaurantChanged,
} from "@/lib/supabase/workspace-persistence";
import { triggerNotificationDeliverReferences } from "@/lib/notifications/trigger-notification-deliver-client";
import { dispatchNotificationsRefresh } from "@/lib/notifications/notification-events";

export type PendingStaffInviteRow = {
  invite_id: string;
  restaurant_id: string;
  staff_id: string;
  restaurant_name: string;
  staff_given_name: string;
  staff_family_name: string;
  position_name: string;
  expires_at: string;
};

export type IncompleteStaffMembershipRow = {
  staff_id: string;
  restaurant_id: string;
  restaurant_name: string;
  staff_given_name: string;
  staff_family_name: string;
  position_name: string;
};

export type PendingStaffInviteState = {
  pendingInvites: PendingStaffInviteRow[];
  incompleteMemberships: IncompleteStaffMembershipRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function usePendingStaffInvites(): PendingStaffInviteState {
  const [pendingInvites, setPendingInvites] = useState<PendingStaffInviteRow[]>(
    [],
  );
  const [incompleteMemberships, setIncompleteMemberships] = useState<
    IncompleteStaffMembershipRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sb = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user?.id) {
      setPendingInvites([]);
      setIncompleteMemberships([]);
      setLoading(false);
      return;
    }

    const [invitesRes, incompleteRes] = await Promise.all([
      sb.rpc("list_auth_user_pending_staff_invites"),
      sb.rpc("list_auth_user_incomplete_staff_memberships"),
    ]);

    if (invitesRes.error || incompleteRes.error) {
      setError(
        invitesRes.error?.message ??
          incompleteRes.error?.message ??
          "Einladungen konnten nicht geladen werden.",
      );
      setLoading(false);
      return;
    }

    const mapInvite = (row: Record<string, unknown>): PendingStaffInviteRow => ({
      invite_id: String(row.invite_id),
      restaurant_id: String(row.restaurant_id),
      staff_id: String(row.staff_id),
      restaurant_name: String(row.restaurant_name ?? ""),
      staff_given_name: String(row.staff_given_name ?? ""),
      staff_family_name: String(row.staff_family_name ?? ""),
      position_name: String(row.position_name ?? ""),
      expires_at: String(row.expires_at ?? ""),
    });

    const mapIncomplete = (
      row: Record<string, unknown>,
    ): IncompleteStaffMembershipRow => ({
      staff_id: String(row.staff_id),
      restaurant_id: String(row.restaurant_id),
      restaurant_name: String(row.restaurant_name ?? ""),
      staff_given_name: String(row.staff_given_name ?? ""),
      staff_family_name: String(row.staff_family_name ?? ""),
      position_name: String(row.position_name ?? ""),
    });

    setPendingInvites(
      (Array.isArray(invitesRes.data) ? invitesRes.data : []).map(mapInvite),
    );
    setIncompleteMemberships(
      (Array.isArray(incompleteRes.data) ? incompleteRes.data : []).map(
        mapIncomplete,
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    pendingInvites,
    incompleteMemberships,
    loading,
    error,
    refresh,
  };
}

export async function acceptPendingStaffInviteClient(params: {
  inviteId: string;
  givenName?: string;
  familyName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.rpc("accept_staff_invite_by_id", {
    p_invite_id: params.inviteId,
    ...(params.givenName?.trim() && params.familyName?.trim()
      ? {
          p_given_name: params.givenName.trim(),
          p_family_name: params.familyName.trim(),
        }
      : {}),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    restaurant_id?: string;
    invite_id?: string;
  } | null;
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? "accept_failed" };
  }

  if (result.restaurant_id && result.invite_id) {
    void triggerNotificationDeliverReferences({
      restaurantId: result.restaurant_id,
      module: "staff_invite_accepted",
      referenceIds: [result.invite_id],
    });
    dispatchNotificationsRefresh();
  }

  invalidateWorkspaceRestaurantCache();
  notifyWorkspaceRestaurantChanged();
  return { ok: true };
}

export async function repairIncompleteStaffMembershipClient(params?: {
  staffId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.rpc("repair_auth_user_staff_team_membership", {
    p_staff_id: params?.staffId ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? "repair_failed" };
  }

  invalidateWorkspaceRestaurantCache();
  notifyWorkspaceRestaurantChanged();
  return { ok: true };
}

export async function declinePendingStaffInviteClient(params: {
  inviteId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.rpc("decline_staff_invite_by_id", {
    p_invite_id: params.inviteId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    restaurant_id?: string;
    invite_id?: string;
  } | null;
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? "decline_failed" };
  }

  if (result.restaurant_id && result.invite_id) {
    void triggerNotificationDeliverReferences({
      restaurantId: result.restaurant_id,
      module: "staff_invite_declined",
      referenceIds: [result.invite_id],
    });
    dispatchNotificationsRefresh();
  }

  return { ok: true };
}
