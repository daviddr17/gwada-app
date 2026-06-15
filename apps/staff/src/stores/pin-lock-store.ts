import { create } from "zustand";
import { getStaffSupabase } from "@/src/lib/supabase";

type PinLockState = {
  hydrated: boolean;
  pinSet: boolean;
  unlocked: boolean;
  failedAttempts: number;
  init: () => Promise<void>;
  setUnlocked: (value: boolean) => void;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<"ok" | "wrong" | "locked" | "not_set">;
  lock: () => void;
  signOutOnLockout: () => Promise<void>;
};

export const usePinLockStore = create<PinLockState>((set, get) => ({
  hydrated: false,
  pinSet: false,
  unlocked: false,
  failedAttempts: 0,

  init: async () => {
    const sb = getStaffSupabase();
    const { data, error } = await sb.rpc("staff_app_pin_status");
    if (error) {
      console.warn("[staff] pin status", error.message);
      set({ hydrated: true, pinSet: false, unlocked: true });
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const pinSet = Boolean((row as { pin_set?: boolean } | null)?.pin_set);
    const failedAttempts =
      Number((row as { failed_attempts?: number } | null)?.failed_attempts) || 0;
    set({
      hydrated: true,
      pinSet,
      unlocked: !pinSet,
      failedAttempts,
    });
  },

  setUnlocked: (value) => set({ unlocked: value }),

  setPin: async (pin) => {
    const sb = getStaffSupabase();
    const { error } = await sb.rpc("set_staff_app_pin", { p_pin: pin });
    if (error) throw new Error(error.message);
    set({ pinSet: true, unlocked: true, failedAttempts: 0 });
  },

  verifyPin: async (pin) => {
    const sb = getStaffSupabase();
    try {
      const { data, error } = await sb.rpc("verify_staff_app_pin", { p_pin: pin });
      if (error) {
        if (error.message.includes("pin_locked")) return "locked";
        throw new Error(error.message);
      }
      if (data === true) {
        set({ unlocked: true, failedAttempts: 0 });
        return "ok";
      }
      const status = await sb.rpc("staff_app_pin_status");
      const row = Array.isArray(status.data) ? status.data[0] : status.data;
      const attempts =
        Number((row as { failed_attempts?: number } | null)?.failed_attempts) || 0;
      set({ failedAttempts: attempts });
      if (attempts >= 5) return "locked";
      return "wrong";
    } catch (err) {
      if (err instanceof Error && err.message.includes("pin_locked")) return "locked";
      throw err;
    }
  },

  lock: () => {
    const { pinSet } = get();
    if (pinSet) set({ unlocked: false });
  },

  signOutOnLockout: async () => {
    const { useAuthStore } = await import("@/src/stores/auth-store");
    await useAuthStore.getState().signOut();
    set({ unlocked: false, pinSet: false, failedAttempts: 0, hydrated: false });
  },
}));
