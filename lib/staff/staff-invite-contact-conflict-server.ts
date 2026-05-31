import "server-only";

import { formatLinkedProfileLabel } from "@/lib/staff/format-linked-profile-label";
import type {
  StaffInviteContactConflict,
  StaffInviteContactConflictResult,
} from "@/lib/staff/staff-invite-contact-conflict-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeStaffInviteEmail(
  email: string | null | undefined,
): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

/** Digits-only comparison (aligned with WhatsApp chat id normalization). */
export function normalizeStaffInvitePhoneDigits(
  phone: string | null | undefined,
): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function formatStaffRecordName(given: string, family: string): string {
  return [given, family].filter(Boolean).join(" ").trim() || "—";
}

type ConnectedStaffRow = {
  id: string;
  email: string | null;
  phone: string | null;
  given_name: string;
  family_name: string;
  profile_id: string;
  linked_profile: {
    given_name: string | null;
    family_name: string | null;
    display_name: string | null;
  } | null;
};

type ActiveEmployeeRow = {
  id: string;
  profile_id: string;
  staff_id: string | null;
  profile: {
    given_name: string | null;
    family_name: string | null;
    display_name: string | null;
  } | null;
};

async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = normalizeStaffInviteEmail(email);
  if (!normalized) return null;

  let page = 1;
  const perPage = 200;
  while (page <= 25) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn("[gwada] staff invite auth email lookup", error.message);
      return null;
    }
    const users = data.users ?? [];
    const match = users.find(
      (user) => normalizeStaffInviteEmail(user.email) === normalized,
    );
    if (match) return match.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

function mapProfileOne<T>(raw: T | T[] | null): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function findStaffRecordConflict(params: {
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  connectedStaff: ConnectedStaffRow[];
  activeProfileIds: Set<string>;
}): Pick<StaffInviteContactConflictResult, "emailConflict" | "phoneConflict"> {
  let emailConflict: StaffInviteContactConflict | null = null;
  let phoneConflict: StaffInviteContactConflict | null = null;

  for (const row of params.connectedStaff) {
    if (!params.activeProfileIds.has(row.profile_id)) continue;

    const profileLabel = formatLinkedProfileLabel(
      mapProfileOne(row.linked_profile),
    );
    const staffName = formatStaffRecordName(row.given_name, row.family_name);

    if (
      !emailConflict &&
      params.normalizedEmail &&
      normalizeStaffInviteEmail(row.email) === params.normalizedEmail
    ) {
      emailConflict = {
        kind: "staff_record",
        label: profileLabel,
        staffName,
      };
    }

    if (
      !phoneConflict &&
      params.normalizedPhone &&
      normalizeStaffInvitePhoneDigits(row.phone) === params.normalizedPhone
    ) {
      phoneConflict = {
        kind: "staff_record",
        label: profileLabel,
        staffName,
      };
    }

    if (emailConflict && phoneConflict) break;
  }

  return { emailConflict, phoneConflict };
}

function findTeamMemberEmailConflict(params: {
  authUserId: string;
  staffId: string;
  activeEmployees: ActiveEmployeeRow[];
  staffNameById: Map<string, string>;
}): StaffInviteContactConflict | null {
  const employee = params.activeEmployees.find(
    (row) => row.profile_id === params.authUserId,
  );
  if (!employee) return null;
  if (employee.staff_id === params.staffId) return null;

  const profileLabel = formatLinkedProfileLabel(mapProfileOne(employee.profile));
  const staffName = employee.staff_id
    ? params.staffNameById.get(employee.staff_id)
    : undefined;

  return {
    kind: "team_member",
    label: profileLabel,
    staffName,
  };
}

export async function resolveStaffInviteContactConflicts(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    email?: string | null;
    phone?: string | null;
    admin?: SupabaseClient | null;
  },
): Promise<StaffInviteContactConflictResult> {
  const normalizedEmail = normalizeStaffInviteEmail(params.email);
  const normalizedPhone = normalizeStaffInvitePhoneDigits(params.phone);

  if (!normalizedEmail && !normalizedPhone) {
    return { emailConflict: null, phoneConflict: null };
  }

  const { data: activeEmployeesRaw } = await sb
    .from("restaurant_employees")
    .select(
      "id, profile_id, staff_id, profile:profiles!profile_id ( given_name, family_name, display_name )",
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("is_active", true);

  const activeEmployees = (activeEmployeesRaw ?? []).map((row) => ({
    id: row.id as string,
    profile_id: row.profile_id as string,
    staff_id: (row.staff_id as string | null) ?? null,
    profile: mapProfileOne(
      row.profile as ActiveEmployeeRow["profile"] | ActiveEmployeeRow["profile"][],
    ),
  }));

  const activeProfileIds = new Set(
    activeEmployees.map((row) => row.profile_id),
  );

  const { data: connectedStaffRaw } = await sb
    .from("restaurant_staff")
    .select(
      `
      id,
      email,
      phone,
      given_name,
      family_name,
      profile_id,
      linked_profile:profiles!profile_id (
        given_name,
        family_name,
        display_name
      )
    `,
    )
    .eq("restaurant_id", params.restaurantId)
    .neq("id", params.staffId)
    .not("profile_id", "is", null);

  const { data: staffNameRows } = await sb
    .from("restaurant_staff")
    .select("id, given_name, family_name")
    .eq("restaurant_id", params.restaurantId)
    .neq("id", params.staffId);

  const staffNameById = new Map(
    (staffNameRows ?? []).map((row) => [
      row.id as string,
      formatStaffRecordName(row.given_name as string, row.family_name as string),
    ]),
  );

  const connectedStaff = (connectedStaffRaw ?? []).map((row) => ({
    id: row.id as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    given_name: row.given_name as string,
    family_name: row.family_name as string,
    profile_id: row.profile_id as string,
    linked_profile: mapProfileOne(
      row.linked_profile as ConnectedStaffRow["linked_profile"] | ConnectedStaffRow["linked_profile"][],
    ),
  }));

  const staffRecordConflicts = findStaffRecordConflict({
    normalizedEmail,
    normalizedPhone,
    connectedStaff,
    activeProfileIds,
  });

  let emailConflict = staffRecordConflicts.emailConflict;
  const phoneConflict = staffRecordConflicts.phoneConflict;

  if (!emailConflict && normalizedEmail) {
    const admin = params.admin ?? createSupabaseAdminClient();
    if (admin) {
      const authUserId = await findAuthUserIdByEmail(admin, normalizedEmail);
      if (authUserId) {
        emailConflict = findTeamMemberEmailConflict({
          authUserId,
          staffId: params.staffId,
          activeEmployees,
          staffNameById,
        });
      }
    }
  }

  return { emailConflict, phoneConflict };
}
