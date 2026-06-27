import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

export type ProfileVisibilitySettings = {
  profile_show_work_hours: boolean;
  profile_show_shift_plan: boolean;
  profile_show_documents: boolean;
  profile_allow_display_pin_self_service: boolean;
};

export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibilitySettings = {
  profile_show_work_hours: true,
  profile_show_shift_plan: true,
  profile_show_documents: true,
  profile_allow_display_pin_self_service: false,
};

export function parseProfileVisibility(
  row: Partial<ProfileVisibilitySettings> | null | undefined,
): ProfileVisibilitySettings {
  return {
    profile_show_work_hours: row?.profile_show_work_hours ?? true,
    profile_show_shift_plan: row?.profile_show_shift_plan ?? true,
    profile_show_documents: row?.profile_show_documents ?? true,
    profile_allow_display_pin_self_service:
      row?.profile_allow_display_pin_self_service ?? false,
  };
}

const PROFILE_ALWAYS_ITEMS: readonly ModuleSubnavItem[] = [
  {
    href: "/profile/persoenliche-daten",
    label: "Übersicht",
    matchMode: "exact",
  },
  {
    href: "/profile/anmeldung",
    label: "Anmeldung",
    matchMode: "exact",
  },
  {
    href: "/profile/benachrichtigungen",
    label: "Benachrichtigungen",
    matchMode: "exact",
  },
];

const PROFILE_STAFF_ITEMS: readonly (ModuleSubnavItem & {
  visibilityKey: keyof ProfileVisibilitySettings;
})[] = [
  {
    href: "/profile/arbeitszeiten",
    label: "Meine Arbeitszeiten",
    matchMode: "exact",
    visibilityKey: "profile_show_work_hours",
  },
  {
    href: "/profile/dienstplan",
    label: "Dienstplan",
    matchMode: "exact",
    visibilityKey: "profile_show_shift_plan",
  },
  {
    href: "/profile/dokumente",
    label: "Meine Dokumente",
    matchMode: "exact",
    visibilityKey: "profile_show_documents",
  },
  {
    href: "/profile/display-pin",
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
    params.pathname === "/profile" ||
    params.pathname.startsWith("/profile/persoenliche-daten") ||
    params.pathname.startsWith("/profile/anmeldung") ||
    params.pathname.startsWith("/profile/benachrichtigungen")
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
