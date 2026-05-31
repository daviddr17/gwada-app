export type StaffPositionTagDefinition = {
  id: string;
  name: string;
  active: boolean;
  backgroundColor: string;
};

export type StaffPresenceStatus = "off" | "working" | "on_break";

export type StaffWorkEntryType =
  | "work"
  | "break"
  | "vacation"
  | "sick"
  | "other";

export type StaffContractPayType = "hourly" | "fixed";

export type StaffEmploymentType =
  | "full_time"
  | "part_time"
  | "mini_job"
  | "fixed_term"
  | "internship"
  | "student"
  | "other";

export type StaffAuditLogAction =
  | "created"
  | "updated"
  | "invite_email"
  | "invite_whatsapp"
  | "invite_accepted"
  | "access_revoked";

export type StaffAuditLogChange = {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
};

export type StaffAuditLogDetails = {
  actorGivenName?: string;
  actorFamilyName?: string;
  changes?: StaffAuditLogChange[];
  summary?: string;
};

export type StaffContractLogAction = StaffAuditLogAction;
export type StaffContractLogChange = StaffAuditLogChange;
export type StaffContractLogDetails = StaffAuditLogDetails;

export type RestaurantStaffLogEntry = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  actor_user_id: string | null;
  action: StaffAuditLogAction;
  details: StaffAuditLogDetails;
  created_at: string;
};

export type RestaurantStaffRow = {
  id: string;
  restaurant_id: string;
  profile_id: string | null;
  employee_id: string | null;
  position_tag_id: string | null;
  restaurant_position_id: string | null;
  given_name: string;
  family_name: string;
  birth_date: string | null;
  nationality: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  avatar_storage_path: string | null;
  created_at: string;
  position_tag: {
    id: string;
    name: string;
    background_color: string;
    is_active: boolean;
  } | null;
  restaurant_position: {
    id: string;
    name: string;
    slug: string;
  } | null;
  linked_profile: {
    given_name: string | null;
    family_name: string | null;
    display_name: string | null;
  } | null;
  linked_employee: {
    id: string;
    role: string;
    is_active: boolean;
    restaurant_position: {
      id: string;
      name: string;
      slug: string;
    } | null;
  } | null;
};

export type RestaurantStaffContractRow = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  valid_from: string;
  valid_to: string | null;
  pay_type: StaffContractPayType;
  hourly_rate_cents: number | null;
  fixed_salary_cents: number | null;
  currency: string;
  note: string | null;
  employment_type: StaffEmploymentType | null;
  vacation_days_per_year: number | null;
};

export type RestaurantStaffContractLogEntry = {
  id: string;
  restaurant_id: string;
  contract_id: string;
  actor_user_id: string | null;
  action: StaffContractLogAction;
  details: StaffContractLogDetails;
  created_at: string;
};

export const STAFF_CONTRACT_PAY_LABELS: Record<StaffContractPayType, string> = {
  hourly: "Stundenlohn",
  fixed: "Festlohn (Monat)",
};

export const STAFF_CONTRACT_PAY_ITEMS: Record<StaffContractPayType, string> =
  STAFF_CONTRACT_PAY_LABELS;

export const STAFF_CONTRACT_PAY_TYPES = Object.keys(
  STAFF_CONTRACT_PAY_LABELS,
) as StaffContractPayType[];

export const STAFF_EMPLOYMENT_LABELS: Record<StaffEmploymentType, string> = {
  full_time: "Vollzeit",
  part_time: "Teilzeit",
  mini_job: "Minijob",
  fixed_term: "Befristet",
  internship: "Praktikum",
  student: "Werkstudent",
  other: "Sonstiges",
};

export const STAFF_EMPLOYMENT_ITEMS: Record<StaffEmploymentType, string> =
  STAFF_EMPLOYMENT_LABELS;

export const STAFF_EMPLOYMENT_TYPES = Object.keys(
  STAFF_EMPLOYMENT_LABELS,
) as StaffEmploymentType[];

export type RestaurantStaffWorkEntryRow = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  entry_type: StaffWorkEntryType;
  starts_at: string;
  ends_at: string;
  note: string | null;
  is_open?: boolean;
  shift_id?: string | null;
};

export type StaffLivePresenceRow = {
  staff_id: string;
  status: Exclude<StaffPresenceStatus, "off">;
  clocked_in_at: string;
  break_started_at: string | null;
};

export type StaffInviteChannel = "email" | "whatsapp";

export type StaffInviteViewerStatus =
  | "anonymous"
  | "can_join"
  | "already_member"
  | "staff_linked_other"
  | "wrong_account";

export function staffDisplayName(row: {
  given_name: string;
  family_name: string;
}): string {
  return [row.given_name, row.family_name].filter(Boolean).join(" ").trim();
}

export const STAFF_WORK_ENTRY_LABELS: Record<StaffWorkEntryType, string> = {
  work: "Arbeitszeit",
  break: "Pause",
  vacation: "Urlaub",
  sick: "Krank",
  other: "Sonstiges",
};

export const STAFF_WORK_ENTRY_COLORS: Record<StaffWorkEntryType, string> = {
  work: "#22c55e",
  break: "#3b82f6",
  vacation: "#ef4444",
  sick: "#ef4444",
  other: "#94a3b8",
};

/** Zusammenfassung: Anwesenheit (Arbeit + Pause), vor Abzug der Pausen. */
export const STAFF_SUMMARY_LOGGED_COLOR = "#64748b";

export const STAFF_WORK_ENTRY_ITEMS: Record<StaffWorkEntryType, string> =
  STAFF_WORK_ENTRY_LABELS;

export const STAFF_WORK_ENTRY_TYPES = Object.keys(
  STAFF_WORK_ENTRY_LABELS,
) as StaffWorkEntryType[];
