/** Shared restaurant Kontakt mailbox: who may read inbound. */

export type SharedInboxAccessMode = "all_staff" | "restricted";

export type SharedInboxAccessConfig = {
  access: SharedInboxAccessMode;
  /** Auth user ids (profiles.id) allowed when access = restricted. */
  userIds: string[];
};

export function parseSharedInboxAccess(raw: unknown): SharedInboxAccessConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { access: "all_staff", userIds: [] };
  }
  const o = raw as Record<string, unknown>;
  const access: SharedInboxAccessMode =
    o.shared_inbox_access === "restricted" ? "restricted" : "all_staff";
  const userIds = Array.isArray(o.shared_inbox_user_ids)
    ? o.shared_inbox_user_ids.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      )
    : [];
  return { access, userIds };
}

export function sharedInboxAccessToConfigPatch(
  access: SharedInboxAccessConfig,
): Record<string, unknown> {
  return {
    shared_inbox_access: access.access,
    shared_inbox_user_ids:
      access.access === "restricted" ? access.userIds : [],
  };
}

/**
 * Whether the viewer may see shared Kontakt inbound (mailbox_owner_user_id null).
 * Managers with integrations.email always may; restricted uses allowlist.
 */
export function canAccessSharedEmailInbox(params: {
  userId: string;
  canManageEmail: boolean;
  access: SharedInboxAccessConfig;
}): boolean {
  if (params.canManageEmail) return true;
  if (params.access.access === "all_staff") return true;
  return params.access.userIds.includes(params.userId);
}
