import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { ColorSchemePreference } from "@/src/theme/tokens";

const STORAGE_KEY = "gwada.staff.appearance";

type AppearanceState = {
  preference: ColorSchemePreference;
  hydrated: boolean;
  init: () => Promise<void>;
  setPreference: (preference: ColorSchemePreference) => Promise<void>;
};

function parsePreference(raw: string | null): ColorSchemePreference | null {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return null;
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  preference: "system",
  hydrated: false,
  init: async () => {
    try {
      const stored = parsePreference(await SecureStore.getItemAsync(STORAGE_KEY));
      if (stored) {
        set({ preference: stored, hydrated: true });
        return;
      }
    } catch {
      // ignore — fall through to default
    }
    set({ hydrated: true });
  },
  setPreference: async (preference) => {
    await SecureStore.setItemAsync(STORAGE_KEY, preference);
    set({ preference });
  },
}));
