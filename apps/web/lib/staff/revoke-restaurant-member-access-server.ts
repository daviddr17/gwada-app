import "server-only";

import { insertStaffAuditLogEntryServer } from "@/lib/staff/staff-audit-log-server";
import { formatLinkedProfileLabel } from "@/lib/staff/format-linked-profile-label";
import type { SupabaseClient } from "@supabase/supabase-js";

type EmployeeRow = {
  id: string;
  profile_id: string;
  role: string;
  is_active: boolean;
  staff_id: string | null;
};

type StaffRow = {
  id: string;
  profile_id: string | null;
  employee_id: string | null;
  given_name: string;
  family_name: string;
};

async function countActiveOwners(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const { count } = await admin
    .from("restaurant_employees")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("role", "owner")
    .eq("is_active", true);
  return count ?? 0;
}

async function loadProfileLabel(
  admin: SupabaseClient,
  profileId: string,
): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("given_name, family_name, display_name")
    .eq("id", profileId)
    .maybeSingle();
  return formatLinkedProfileLabel(
    data as {
      given_name: string | null;
      family_name: string | null;
      display_name: string | null;
    } | null,
  );
}

export async function revokeRestaurantMemberAccess(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    actorUserId: string;
    staffId?: string;
    employeeId?: string;
  },
): Promise<
  | { ok: true; staffId: string | null; profileLabel: string }
  | { ok: false; error: string }
> {
  const { restaurantId, actorUserId } = params;
  let employee: EmployeeRow | null = null;
  let staff: StaffRow | null = null;

  if (params.staffId) {
    const { data: staffRow } = await admin
      .from("restaurant_staff")
      .select("id, profile_id, employee_id, given_name, family_name")
      .eq("id", params.staffId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!staffRow) return { ok: false, error: "not_found" };
    staff = staffRow as StaffRow;

    if (staff.employee_id) {
      const { data: emp } = await admin
        .from("restaurant_employees")
        .select("id, profile_id, role, is_active, staff_id")
        .eq("id", staff.employee_id)
        .maybeSingle();
      employee = (emp as EmployeeRow | null) ?? null;
    }
    if (!employee && staff.profile_id) {
      const { data: emp } = await admin
        .from("restaurant_employees")
        .select("id, profile_id, role, is_active, staff_id")
        .eq("restaurant_id", restaurantId)
        .eq("profile_id", staff.profile_id)
        .maybeSingle();
      employee = (emp as EmployeeRow | null) ?? null;
    }
  }

  if (params.employeeId && !employee) {
    const { data: emp } = await admin
      .from("restaurant_employees")
      .select("id, profile_id, role, is_active, staff_id")
      .eq("id", params.employeeId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!emp) return { ok: false, error: "not_found" };
    employee = emp as EmployeeRow;

    if (employee.staff_id && !staff) {
      const { data: staffRow } = await admin
        .from("restaurant_staff")
        .select("id, profile_id, employee_id, given_name, family_name")
        .eq("id", employee.staff_id)
        .maybeSingle();
      staff = (staffRow as StaffRow | null) ?? null;
    }
  }

  if (!employee) {
    return { ok: false, error: "not_found" };
  }

  if (!employee.is_active && !staff?.profile_id) {
    return { ok: false, error: "already_revoked" };
  }

  if (employee.profile_id === actorUserId) {
    return { ok: false, error: "cannot_revoke_self" };
  }

  if (employee.role === "owner" && employee.is_active) {
    const owners = await countActiveOwners(admin, restaurantId);
    if (owners <= 1) {
      return { ok: false, error: "last_owner" };
    }
  }

  const profileLabel = await loadProfileLabel(admin, employee.profile_id);

  const { error: employeeError } = await admin
    .from("restaurant_employees")
    .update({ is_active: false })
    .eq("id", employee.id);
  if (employeeError) {
    return { ok: false, error: employeeError.message };
  }

  const staffId = staff?.id ?? employee.staff_id;
  if (staffId) {
    await admin
      .from("restaurant_staff_invites")
      .update({ status: "revoked" })
      .eq("staff_id", staffId)
      .eq("status", "pending");

    const { error: staffError } = await admin
      .from("restaurant_staff")
      .update({ profile_id: null, employee_id: null })
      .eq("id", staffId);
    if (staffError) {
      return { ok: false, error: staffError.message };
    }

    await insertStaffAuditLogEntryServer({
      restaurantId,
      staffId,
      actorUserId,
      action: "access_revoked",
      details: {
        summary: `App-Zugang entzogen (${profileLabel})`,
      },
    });
  }

  return { ok: true, staffId: staffId ?? null, profileLabel };
}
