export type StaffInviteContactConflictKind = "staff_record" | "team_member";

export type StaffInviteContactConflict = {
  kind: StaffInviteContactConflictKind;
  /** App-Account display name */
  label: string;
  /** Linked Mitarbeiter record name (staff_record or when known) */
  staffName?: string;
};

export type StaffInviteContactConflictResult = {
  emailConflict: StaffInviteContactConflict | null;
  phoneConflict: StaffInviteContactConflict | null;
};
