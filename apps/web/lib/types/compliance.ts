export const COMPLIANCE_CATEGORIES = [
  "temperature",
  "cleaning",
  "goods_receipt",
  "hot_hold",
  "cooking",
  "other",
] as const;

export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number];

export const COMPLIANCE_CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  temperature: "Temperatur",
  cleaning: "Reinigung",
  goods_receipt: "Wareneingang",
  hot_hold: "Warmhalten",
  cooking: "Kerntemperatur",
  other: "Sonstiges",
};

export const COMPLIANCE_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "per_delivery",
  "ad_hoc",
] as const;

export type ComplianceFrequency = (typeof COMPLIANCE_FREQUENCIES)[number];

export const COMPLIANCE_FREQUENCY_LABELS: Record<ComplianceFrequency, string> = {
  daily: "Täglich",
  weekly: "Wöchentlich",
  monthly: "Monatlich",
  per_delivery: "Pro Lieferung",
  ad_hoc: "Bei Bedarf",
};

export const COMPLIANCE_DEVICE_TYPES = [
  "fridge",
  "freezer",
  "cold_room",
  "probe",
  "other",
] as const;

export type ComplianceDeviceType = (typeof COMPLIANCE_DEVICE_TYPES)[number];

export const COMPLIANCE_DEVICE_TYPE_LABELS: Record<ComplianceDeviceType, string> =
  {
    fridge: "Kühlschrank",
    freezer: "Tiefkühlgerät",
    cold_room: "Kühlraum",
    probe: "Thermometer",
    other: "Sonstiges",
  };

export const COMPLIANCE_FIELD_TYPES = [
  "temperature",
  "boolean",
  "number",
  "text",
  "select",
] as const;

export type ComplianceFieldType = (typeof COMPLIANCE_FIELD_TYPES)[number];

export const COMPLIANCE_FIELD_TYPE_LABELS: Record<ComplianceFieldType, string> = {
  temperature: "Temperatur (°C)",
  boolean: "Ja/Nein",
  number: "Zahl",
  text: "Text",
  select: "Auswahl",
};

export type ComplianceChecklistItem = {
  id: string;
  label: string;
  fieldType: ComplianceFieldType;
  deviceId?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  required?: boolean;
  options?: string[];
};

export type ComplianceRecordValue = {
  value: string | number | boolean | null;
  withinLimits?: boolean | null;
};

export type ComplianceRecordValues = Record<string, ComplianceRecordValue>;

export type RestaurantComplianceDeviceRow = {
  id: string;
  restaurant_id: string;
  name: string;
  device_type: ComplianceDeviceType;
  location: string | null;
  target_min: number | null;
  target_max: number | null;
  is_active: boolean;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ComplianceAssigneeType = "staff" | "position_tag" | "mixed";

export type CompliancePriority = "high" | "medium" | "low";

export type ComplianceDeferTrigger =
  | "clock_in"
  | "break_start"
  | "break_end"
  | "clock_out"
  | "pin_login";

export const COMPLIANCE_PRIORITY_LABELS: Record<CompliancePriority, string> = {
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

export type RestaurantComplianceChecklistRow = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  category: ComplianceCategory;
  frequency: ComplianceFrequency;
  items: ComplianceChecklistItem[];
  show_on_display: boolean;
  is_active: boolean;
  archived_at: string | null;
  sort_order: number;
  assignee_type: ComplianceAssigneeType | null;
  staff_id: string | null;
  position_tag_id: string | null;
  priority: CompliancePriority;
  display_from: string | null;
  display_until: string | null;
  show_before_clock_in: boolean;
  show_before_break_start: boolean;
  show_before_break_end: boolean;
  show_before_clock_out: boolean;
  show_on_pin_login: boolean;
  require_defer_reason: boolean;
  blocks_shift_end: boolean;
  created_at: string;
  updated_at: string;
  staff?: { id: string; given_name: string; family_name: string | null } | null;
  position_tag?: { id: string; name: string } | null;
  staff_assignees?: {
    staff_id: string;
    staff?: { id: string; given_name: string; family_name: string | null } | null;
  }[];
  position_assignees?: {
    position_tag_id: string;
    position_tag?: { id: string; name: string } | null;
  }[];
  last_performed_at?: string | null;
};

export type RestaurantComplianceRecordRow = {
  id: string;
  restaurant_id: string;
  checklist_id: string;
  performed_at: string;
  performed_by_staff_id: string | null;
  performed_by_user_id: string | null;
  values: ComplianceRecordValues;
  corrective_action: string | null;
  notes: string | null;
  has_deviation: boolean;
  source: "dashboard" | "display";
  created_at: string;
  updated_at: string;
  checklist?: Pick<
    RestaurantComplianceChecklistRow,
    "id" | "name" | "category"
  > | null;
  staff?: {
    id: string;
    given_name: string;
    family_name: string;
  } | null;
  profile?: {
    id: string;
    display_name: string | null;
  } | null;
};

export const COMPLIANCE_LOG_ACTIONS = [
  "checklist_created",
  "checklist_updated",
  "checklist_archived",
  "device_created",
  "device_updated",
  "device_archived",
  "record_created",
  "record_updated",
  "deferred",
  "templates_seeded",
] as const;

export type ComplianceLogAction = (typeof COMPLIANCE_LOG_ACTIONS)[number];

export const COMPLIANCE_LOG_ACTION_LABELS: Record<ComplianceLogAction, string> =
  {
    checklist_created: "Vorlage angelegt",
    checklist_updated: "Vorlage geändert",
    checklist_archived: "Vorlage archiviert",
    device_created: "Gerät angelegt",
    device_updated: "Gerät geändert",
    device_archived: "Gerät archiviert",
    record_created: "Eintrag erfasst",
    record_updated: "Eintrag geändert",
    deferred: "Verschoben",
    templates_seeded: "Standardvorlagen importiert",
  };

export type RestaurantComplianceLogEntry = {
  id: string;
  restaurant_id: string;
  checklist_id: string | null;
  record_id: string | null;
  device_id: string | null;
  action: ComplianceLogAction;
  actor_user_id: string | null;
  actor_staff_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  checklist?: { id: string; name: string } | null;
  actor_profile?: { id: string; display_name: string | null } | null;
  actor_staff?: {
    id: string;
    given_name: string;
    family_name: string;
  } | null;
};

export type ComplianceDeviceUpsertInput = {
  name: string;
  deviceType: ComplianceDeviceType;
  location?: string | null;
  targetMin?: number | null;
  targetMax?: number | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type ComplianceChecklistUpsertInput = {
  name: string;
  description?: string | null;
  category: ComplianceCategory;
  frequency: ComplianceFrequency;
  items: ComplianceChecklistItem[];
  showOnDisplay?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  staffIds?: string[];
  positionTagIds?: string[];
  priority?: CompliancePriority;
  displayFrom?: string | null;
  displayUntil?: string | null;
  showBeforeClockIn?: boolean;
  showBeforeBreakStart?: boolean;
  showBeforeBreakEnd?: boolean;
  showBeforeClockOut?: boolean;
  showOnPinLogin?: boolean;
  requireDeferReason?: boolean;
  blocksShiftEnd?: boolean;
};

export type ComplianceRecordUpsertInput = {
  checklistId: string;
  performedAt?: string;
  values: ComplianceRecordValues;
  correctiveAction?: string | null;
  notes?: string | null;
  source?: "dashboard" | "display";
  performedByStaffId?: string | null;
};

export type RestaurantComplianceSettingsRow = {
  restaurant_id: string;
  require_corrective_on_deviation: boolean;
  show_due_reminders: boolean;
  created_at: string;
  updated_at: string;
};
