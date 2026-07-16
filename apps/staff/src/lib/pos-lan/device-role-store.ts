import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { PosLanDeviceRole } from "@gwada/pos-lan";

const ROLE_KEY = "gwada_pos_lan_device_role";

function isIpadDevice(): boolean {
  return (
    Platform.OS === "ios" &&
    Boolean((Platform as { isPad?: boolean }).isPad)
  );
}

function defaultRole(): PosLanDeviceRole {
  // iPad = Kasse/Hub; iPhone = Handgerät
  return isIpadDevice() ? "hub" : "handheld";
}

type DeviceRoleState = {
  role: PosLanDeviceRole;
  ready: boolean;
  init: () => Promise<void>;
  setRole: (role: PosLanDeviceRole) => Promise<void>;
};

export const usePosDeviceRoleStore = create<DeviceRoleState>((set, get) => ({
  role: defaultRole(),
  ready: false,

  init: async () => {
    if (get().ready) return;
    try {
      const stored = await SecureStore.getItemAsync(ROLE_KEY);
      if (stored === "hub" || stored === "handheld") {
        set({ role: stored, ready: true });
        return;
      }
    } catch {
      // SecureStore unavailable — Default behalten
    }
    set({ role: defaultRole(), ready: true });
  },

  setRole: async (role) => {
    await SecureStore.setItemAsync(ROLE_KEY, role);
    set({ role, ready: true });
  },
}));

export function getPosDeviceRole(): PosLanDeviceRole {
  return usePosDeviceRoleStore.getState().role;
}
