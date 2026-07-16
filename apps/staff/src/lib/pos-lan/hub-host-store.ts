import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { parseLanHostInput } from "@/src/lib/staff-lan-host";

const HUB_HOST_KEY = "gwada_pos_lan_hub_host";

type HubHostState = {
  hubHost: string | null;
  ready: boolean;
  init: () => Promise<void>;
  setHubHost: (raw: string) => Promise<string>;
  clearHubHost: () => Promise<void>;
};

export const usePosHubHostStore = create<HubHostState>((set) => ({
  hubHost: null,
  ready: false,

  init: async () => {
    try {
      const stored = await SecureStore.getItemAsync(HUB_HOST_KEY);
      set({
        hubHost: stored ? parseLanHostInput(stored) : null,
        ready: true,
      });
    } catch {
      set({ hubHost: null, ready: true });
    }
  },

  setHubHost: async (raw) => {
    const host = parseLanHostInput(raw);
    if (!host) {
      throw new Error("Ungültige Hub-Adresse — z. B. 192.168.178.40");
    }
    await SecureStore.setItemAsync(HUB_HOST_KEY, host);
    set({ hubHost: host, ready: true });
    return host;
  },

  clearHubHost: async () => {
    await SecureStore.deleteItemAsync(HUB_HOST_KEY);
    set({ hubHost: null });
  },
}));
