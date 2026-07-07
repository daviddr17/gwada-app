import type { RestaurantStaffRow } from "@/lib/types/staff";

export type StaffLastLoginSource = "app" | "display";

export const STAFF_LAST_LOGIN_SOURCE_LABELS: Record<StaffLastLoginSource, string> =
  {
    app: "Letzter Login in der App",
    display: "Letzter Login am Display",
  };

const lastLoginFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function resolveStaffLastLogin(
  row: Pick<RestaurantStaffRow, "linked_profile">,
  lastDisplayActivityAt: string | null | undefined,
): { iso: string; source: StaffLastLoginSource } | null {
  const appSeen = row.linked_profile?.last_seen_at ?? null;
  if (!appSeen && !lastDisplayActivityAt) return null;
  if (!appSeen && lastDisplayActivityAt) {
    return { iso: lastDisplayActivityAt, source: "display" };
  }
  if (appSeen && !lastDisplayActivityAt) {
    return { iso: appSeen, source: "app" };
  }
  if (new Date(appSeen!) >= new Date(lastDisplayActivityAt!)) {
    return { iso: appSeen!, source: "app" };
  }
  return { iso: lastDisplayActivityAt!, source: "display" };
}

export function staffLastLoginIso(
  row: Pick<RestaurantStaffRow, "linked_profile">,
  lastDisplayActivityAt: string | null | undefined,
): string | null {
  return resolveStaffLastLogin(row, lastDisplayActivityAt)?.iso ?? null;
}

export function formatStaffLastLogin(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return lastLoginFmt.format(new Date(iso));
  } catch {
    return "—";
  }
}
