import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export type ProfileVisibilitySettings = {
  profile_show_work_hours: boolean;
  profile_show_shift_plan: boolean;
  profile_show_documents: boolean;
  profile_show_availability: boolean;
  profile_allow_display_pin_self_service: boolean;
};

export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibilitySettings = {
  profile_show_work_hours: true,
  profile_show_shift_plan: true,
  profile_show_documents: true,
  profile_show_availability: true,
  profile_allow_display_pin_self_service: false,
};

export function parseProfileVisibility(
  row: Partial<ProfileVisibilitySettings> | null | undefined,
): ProfileVisibilitySettings {
  return {
    profile_show_work_hours: row?.profile_show_work_hours ?? true,
    profile_show_shift_plan: row?.profile_show_shift_plan ?? true,
    profile_show_documents: row?.profile_show_documents ?? true,
    profile_show_availability: row?.profile_show_availability ?? true,
    profile_allow_display_pin_self_service:
      row?.profile_allow_display_pin_self_service ?? false,
  };
}

const PROFILE_ALWAYS_ITEMS: readonly ModuleSubnavItem[] = [
  {
    href: APP_ROUTES.profile.personal,
    label: "Übersicht",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.profile.login,
    label: "Anmeldung",
    matchMode: "exact",
  },
  {
    href: APP_ROUTES.profile.notifications,
    label: "Benachrichtigungen",
    matchMode: "exact",
  },
];

const PROFILE_STAFF_ITEMS: readonly (ModuleSubnavItem & {
  visibilityKey: keyof ProfileVisibilitySettings;
})[] = [
  {
    href: APP_ROUTES.profile.workHours,
    label: "Meine Arbeitszeiten",
    matchMode: "exact",
    visibilityKey: "profile_show_work_hours",
  },
  {
    href: APP_ROUTES.profile.schedule,
    label: "Dienstplan",
    matchMode: "exact",
    visibilityKey: "profile_show_shift_plan",
  },
  {
    href: APP_ROUTES.profile.availability,
    label: "Verfügbarkeit",
    matchMode: "exact",
    visibilityKey: "profile_show_availability",
  },
  {
    href: APP_ROUTES.profile.documents,
    label: "Meine Dokumente",
    matchMode: "exact",
    visibilityKey: "profile_show_documents",
  },
  {
    href: APP_ROUTES.profile.displayPin,
    label: "Display-PIN",
    matchMode: "exact",
    visibilityKey: "profile_allow_display_pin_self_service",
  },
];

export function buildProfileNavItems(params: {
  visibility: ProfileVisibilitySettings;
  hasStaffProfile: boolean;
}): ModuleSubnavItem[] {
  const items: ModuleSubnavItem[] = [...PROFILE_ALWAYS_ITEMS];

  if (!params.hasStaffProfile) {
    return items;
  }

  for (const entry of PROFILE_STAFF_ITEMS) {
    if (params.visibility[entry.visibilityKey]) {
      items.push({
        href: entry.href,
        label: entry.label,
        matchMode: entry.matchMode,
      });
    }
  }

  return items;
}

export function isProfileRouteAllowed(params: {
  pathname: string;
  visibility: ProfileVisibilitySettings;
  hasStaffProfile: boolean;
}): boolean {
  if (
    params.pathname === APP_ROUTES.profile.root ||
    params.pathname.startsWith(APP_ROUTES.profile.personal) ||
    params.pathname.startsWith(APP_ROUTES.profile.login) ||
    params.pathname.startsWith(APP_ROUTES.profile.notifications)
  ) {
    return true;
  }

  if (!params.hasStaffProfile) {
    return false;
  }

  for (const entry of PROFILE_STAFF_ITEMS) {
    if (params.pathname.startsWith(entry.href)) {
      return params.visibility[entry.visibilityKey];
    }
  }

  return true;
}
