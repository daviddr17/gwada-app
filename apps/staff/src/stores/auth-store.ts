import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { getStaffSupabaseUrl } from "@/src/lib/env";
import { initStaffLanHost } from "@/src/lib/staff-lan-host";
import { getStaffSupabase, resetStaffSupabaseClient } from "@/src/lib/supabase";

export type StaffRestaurant = {
  restaurantId: string;
  name: string;
  slug: string;
  brandAccentHex: string | null;
};

type AuthState = {
  session: Session | null;
  restaurants: StaffRestaurant[];
  activeRestaurantId: string | null;
  isLoading: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setActiveRestaurant: (restaurantId: string) => Promise<void>;
  refreshRestaurants: () => Promise<void>;
};

async function loadRestaurants(userId: string): Promise<StaffRestaurant[]> {
  const sb = getStaffSupabase();

  const { data: profile } = await sb
    .from("profiles")
    .select("active_restaurant_id")
    .eq("id", userId)
    .maybeSingle();

  const { data, error } = await sb
    .from("restaurant_employees")
    .select(
      "restaurant_id, restaurants(id, name, slug, brand_accent_hex)",
    )
    .eq("profile_id", userId)
    .eq("is_active", true);

  if (error) {
    console.warn("[staff] restaurants", error.message);
    return [];
  }

  const rows: StaffRestaurant[] = [];
  for (const row of data ?? []) {
    const r = row.restaurants as
      | {
          id: string;
          name: string;
          slug: string;
          brand_accent_hex: string | null;
        }
      | Array<{
          id: string;
          name: string;
          slug: string;
          brand_accent_hex: string | null;
        }>
      | null;
    const rr = Array.isArray(r) ? r[0] : r;
    if (!rr) continue;
    rows.push({
      restaurantId: row.restaurant_id as string,
      name: rr.name,
      slug: rr.slug,
      brandAccentHex: rr.brand_accent_hex,
    });
  }

  const activeFromProfile = profile?.active_restaurant_id as string | null;
  if (
    activeFromProfile &&
    rows.some((r) => r.restaurantId === activeFromProfile)
  ) {
    useAuthStore.setState({ activeRestaurantId: activeFromProfile });
  } else if (rows.length === 1) {
    useAuthStore.setState({ activeRestaurantId: rows[0]!.restaurantId });
  }

  return rows;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  restaurants: [],
  activeRestaurantId: null,
  isLoading: true,

  init: async () => {
    await initStaffLanHost();
    resetStaffSupabaseClient();
    const sb = getStaffSupabase();
    const { data } = await sb.auth.getSession();
    const session = data.session ?? null;
    set({ session });

    if (session?.user) {
      const restaurants = await loadRestaurants(session.user.id);
      set({ restaurants });
    }

    sb.auth.onAuthStateChange(async (_event, next) => {
      set({ session: next });
      if (next?.user) {
        const restaurants = await loadRestaurants(next.user.id);
        set({ restaurants });
      } else {
        set({ restaurants: [], activeRestaurantId: null });
      }
    });

    set({ isLoading: false });
  },

  signIn: async (email, password) => {
    resetStaffSupabaseClient();
    const sb = getStaffSupabase();
    await sb.auth.signOut().catch(() => undefined);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    const { error } = await sb.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });
    if (error) {
      if (__DEV__) {
        console.warn(
          "[staff] signIn",
          error.message,
          "url=",
          getStaffSupabaseUrl(),
          "emailLen=",
          normalizedEmail.length,
          "pwLen=",
          normalizedPassword.length,
        );
      }
      throw new Error(error.message);
    }
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session?.user) throw new Error("session_missing");
    const restaurants = await loadRestaurants(session.user.id);
    set({ session, restaurants });
  },

  signOut: async () => {
    await getStaffSupabase().auth.signOut();
    set({ session: null, restaurants: [], activeRestaurantId: null });
  },

  setActiveRestaurant: async (restaurantId) => {
    const session = get().session;
    if (!session?.user) return;
    const sb = getStaffSupabase();
    await sb
      .from("profiles")
      .update({ active_restaurant_id: restaurantId })
      .eq("id", session.user.id);
    set({ activeRestaurantId: restaurantId });
  },

  refreshRestaurants: async () => {
    const session = get().session;
    if (!session?.user) return;
    const restaurants = await loadRestaurants(session.user.id);
    set({ restaurants });
  },
}));
