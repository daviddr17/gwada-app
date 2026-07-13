import {
  hasModuleRead,
  type ModuleCrudPrefix,
} from "@/lib/permissions/module-crud-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";

export type NotificationModuleAccessContext = {
  has: (key: RestaurantPermissionKey) => boolean;
  /** Verknüpftes restaurant_staff-Profil im aktiven Workspace. */
  hasStaffProfile: boolean;
};

type NotificationModuleAccessRule =
  | { kind: "always" }
  | { kind: "module"; prefix: ModuleCrudPrefix }
  | { kind: "staffProfile" }
  | { kind: "staffModuleOrProfile"; prefix: ModuleCrudPrefix };

const NOTIFICATION_MODULE_ACCESS: Record<
  NotificationModuleId,
  NotificationModuleAccessRule
> = {
  messages: { kind: "module", prefix: "contacts" },
  reviews: { kind: "module", prefix: "reviews" },
  changelog: { kind: "always" },
  reservations_pending: { kind: "module", prefix: "reservations" },
  reservations_change_request: { kind: "module", prefix: "reservations" },
  reservations_cancellation: { kind: "module", prefix: "reservations" },
  staff_shift_start: { kind: "staffModuleOrProfile", prefix: "staff" },
  staff_shift_end: { kind: "staffModuleOrProfile", prefix: "staff" },
  staff_todo_completed: { kind: "staffModuleOrProfile", prefix: "staff_todos" },
  staff_todo_deferred: { kind: "staffModuleOrProfile", prefix: "staff_todos" },
  staff_contract_signed: { kind: "staffProfile" },
  staff_display_time_request: { kind: "module", prefix: "staff" },
  staff_invite_accepted: { kind: "module", prefix: "staff" },
  staff_invite_declined: { kind: "module", prefix: "staff" },
  staff_display_clock_in: { kind: "module", prefix: "staff" },
  staff_display_clock_out: { kind: "module", prefix: "staff" },
  inventory_low_stock: { kind: "module", prefix: "inventory" },
  accounting_quotation: { kind: "module", prefix: "accounting" },
  accounting_invoice: { kind: "module", prefix: "accounting" },
  accounting_voucher: { kind: "module", prefix: "accounting" },
};

export function isNotificationModuleVisibleForUser(
  moduleId: NotificationModuleId,
  ctx: NotificationModuleAccessContext,
): boolean {
  const rule = NOTIFICATION_MODULE_ACCESS[moduleId];

  switch (rule.kind) {
    case "always":
      return true;
    case "module":
      return hasModuleRead(ctx.has, rule.prefix);
    case "staffProfile":
      return ctx.hasStaffProfile;
    case "staffModuleOrProfile":
      return hasModuleRead(ctx.has, rule.prefix) || ctx.hasStaffProfile;
    default:
      return false;
  }
}

export function filterNotificationModulesForUser(
  moduleIds: readonly NotificationModuleId[],
  ctx: NotificationModuleAccessContext,
): NotificationModuleId[] {
  return moduleIds.filter((id) =>
    isNotificationModuleVisibleForUser(id, ctx),
  );
}
