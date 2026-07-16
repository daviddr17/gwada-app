import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { PosLanDeviceRole } from "@gwada/pos-lan";

/** Nur gesetzt, wenn der Nutzer die Rolle manuell überschreibt. */
const ROLE_OVERRIDE_KEY = "gwada_pos_lan_device_role_override";
/** Legacy-Key aus Phase-1-MVP (wurde immer gespeichert). */
const LEGACY_ROLE_KEY = "gwada_pos_lan_device_role";

export type PosLanRoleSource = "auto" | "manual";

export function isIpadDevice(): boolean {
  return (
    Platform.OS === "ios" &&
    Boolean((Platform as { isPad?: boolean }).isPad)
  );
}

/** Gleiche App: iPad → Kasse/Server, iPhone → Handgerät. */
export function detectPosDeviceRole(): PosLanDeviceRole {
  return isIpadDevice() ? "hub" : "handheld";
}

function deviceKindLabel(): string {
  if (isIpadDevice()) return "iPad";
  if (Platform.OS === "ios") return "iPhone";
  return Platform.OS === "android" ? "Android" : "Gerät";
}

type DeviceRoleState = {
  role: PosLanDeviceRole;
  source: PosLanRoleSource;
  ready: boolean;
  /** z. B. „Automatisch: iPad → Kasse“ */
  detectionLabel: string;
  init: () => Promise<void>;
  /** Manueller Override (bleibt gespeichert, bis zurückgesetzt). */
  setRoleManual: (role: PosLanDeviceRole) => Promise<void>;
  /** Override löschen → wieder Geräteerkennung. */
  resetToAuto: () => Promise<void>;
};

function labelFor(role: PosLanDeviceRole, source: PosLanRoleSource): string {
  const kind = deviceKindLabel();
  const roleText = role === "hub" ? "Kasse (Server)" : "Handgerät";
  if (source === "auto") {
    return `Automatisch: ${kind} → ${roleText}`;
  }
  return `Manuell: ${roleText}`;
}

export const usePosDeviceRoleStore = create<DeviceRoleState>((set, get) => ({
  role: detectPosDeviceRole(),
  source: "auto",
  ready: false,
  detectionLabel: labelFor(detectPosDeviceRole(), "auto"),

  init: async () => {
    if (get().ready) return;
    try {
      const override = await SecureStore.getItemAsync(ROLE_OVERRIDE_KEY);
      if (override === "hub" || override === "handheld") {
        set({
          role: override,
          source: "manual",
          ready: true,
          detectionLabel: labelFor(override, "manual"),
        });
        return;
      }

      // Legacy: früher wurde die Rolle immer persistiert → als Override übernehmen
      // und alten Key entfernen, damit frische Installs wieder Auto nutzen.
      const legacy = await SecureStore.getItemAsync(LEGACY_ROLE_KEY);
      if (legacy === "hub" || legacy === "handheld") {
        await SecureStore.deleteItemAsync(LEGACY_ROLE_KEY);
        // Nicht als Override speichern — Auto-Erkennung ab jetzt
      }
    } catch {
      // SecureStore unavailable — Auto behalten
    }

    const role = detectPosDeviceRole();
    set({
      role,
      source: "auto",
      ready: true,
      detectionLabel: labelFor(role, "auto"),
    });
  },

  setRoleManual: async (role) => {
    await SecureStore.setItemAsync(ROLE_OVERRIDE_KEY, role);
    set({
      role,
      source: "manual",
      ready: true,
      detectionLabel: labelFor(role, "manual"),
    });
  },

  resetToAuto: async () => {
    try {
      await SecureStore.deleteItemAsync(ROLE_OVERRIDE_KEY);
    } catch {
      // ignore
    }
    const role = detectPosDeviceRole();
    set({
      role,
      source: "auto",
      ready: true,
      detectionLabel: labelFor(role, "auto"),
    });
  },
}));

export function getPosDeviceRole(): PosLanDeviceRole {
  return usePosDeviceRoleStore.getState().role;
}
