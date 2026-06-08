import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuthStore } from "@/src/stores/auth-store";
import { gwadaColors, type GwadaColors } from "@/src/theme/tokens";

type StaffTheme = {
  colors: GwadaColors;
};

const StaffThemeContext = createContext<StaffTheme>({
  colors: gwadaColors,
});

function parseHexColor(hex: string | null | undefined): string | null {
  const raw = hex?.trim();
  if (!raw || !/^#[0-9A-Fa-f]{6}$/.test(raw)) return null;
  return raw;
}

function foregroundForBackground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0a0a0a" : "#ffffff";
}

export function StaffThemeProvider({ children }: { children: ReactNode }) {
  const restaurants = useAuthStore((s) => s.restaurants);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);

  const colors = useMemo(() => {
    const active = restaurants.find((r) => r.restaurantId === activeRestaurantId);
    const accent = parseHexColor(active?.brandAccentHex) ?? gwadaColors.accent;
    return {
      ...gwadaColors,
      accent,
      accentForeground: foregroundForBackground(accent),
    };
  }, [restaurants, activeRestaurantId]);

  return (
    <StaffThemeContext.Provider value={{ colors }}>
      {children}
    </StaffThemeContext.Provider>
  );
}

export function useStaffTheme(): StaffTheme {
  return useContext(StaffThemeContext);
}
