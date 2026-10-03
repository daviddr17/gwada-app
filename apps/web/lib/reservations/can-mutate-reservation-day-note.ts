import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

type PermissionHas = (key: RestaurantPermissionKey) => boolean;

/** Eigene Tagesnotiz oder Reservierungen: Bearbeiten (inkl. .manage / Inhaber). */
export function canEditReservationDayNote(
  isOwn: boolean,
  has: PermissionHas,
): boolean {
  return (
    isOwn || has("reservations.update") || has("reservations.manage")
  );
}

/** Eigene Tagesnotiz oder Reservierungen: Löschen (inkl. .manage / Inhaber). */
export function canDeleteReservationDayNote(
  isOwn: boolean,
  has: PermissionHas,
): boolean {
  return (
    isOwn || has("reservations.delete") || has("reservations.manage")
  );
}
