export type DisplayModule =
  | "time"
  | "reservations"
  | "recipes"
  | "inventory"
  | "kds";

export type DisplayModuleMeta = {
  id: DisplayModule;
  label: string;
  description: string;
};

export const DISPLAY_MODULES: readonly DisplayModuleMeta[] = [
  {
    id: "time",
    label: "Zeiterfassung",
    description: "Schicht starten, Pause, Schicht beenden",
  },
  {
    id: "reservations",
    label: "Reservierungen",
    description: "Tagesliste, Check-in, Status",
  },
  {
    id: "recipes",
    label: "Rezepte",
    description: "Gerichte und Zutaten",
  },
  {
    id: "inventory",
    label: "Bestand & Bestellung",
    description: "Bestand erfassen und Bestellmengen eingeben",
  },
  {
    id: "kds",
    label: "Bestellungen",
    description: "Küchen-Display (folgt)",
  },
] as const;

export type DisplayRow = {
  id: string;
  restaurant_id: string;
  name: string;
  allowed_modules: DisplayModule[];
  auto_lock_seconds: number;
  is_active: boolean;
  is_paired: boolean;
  created_at: string;
};

export type DisplayStaffLoginRow = {
  id: string;
  given_name: string;
  family_name: string;
  has_pin: boolean;
  avatar_url: string | null;
  position_name: string | null;
};

export type DisplaySessionStaff = {
  id: string;
  given_name: string;
  family_name: string;
  avatar_url: string | null;
  position_name: string | null;
};

/** Warum das Tablet nicht eingeloggt ist (nur wenn paired=false). */
export type DisplayPairingStatus =
  | "no_device_cookie"
  | "display_missing"
  | "display_inactive"
  | "not_paired_server"
  | "token_revoked";

export type DisplayContextResponse = {
  paired: boolean;
  /** Nur gesetzt, wenn paired=false — für klare Tablet-Hinweise. */
  pairing_status?: DisplayPairingStatus;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    accent_hex: string | null;
    avatar_url: string | null;
    cover_url: string | null;
  } | null;
  display: {
    id: string;
    name: string;
    allowed_modules: DisplayModule[];
    auto_lock_seconds: number;
  } | null;
  session: {
    id: string;
    staff: DisplaySessionStaff;
    modules: DisplayModule[];
    can_switch_modules: boolean;
    last_activity_at: string;
  } | null;
  time_session: {
    status: "off" | "working" | "on_break";
    clocked_in_at: string | null;
    break_started_at: string | null;
  } | null;
};
