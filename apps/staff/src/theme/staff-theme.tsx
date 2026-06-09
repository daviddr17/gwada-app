import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { useAppearanceStore } from "@/src/stores/appearance-store";
import {
  resolveColorScheme,
  resolveGwadaColors,
  gwadaColorsLight,
  type ColorSchemePreference,
  type GwadaColors,
  type ResolvedColorScheme,
} from "@/src/theme/tokens";
import { useAuthStore } from "@/src/stores/auth-store";

type StaffTheme = {
  colors: GwadaColors;
  preference: ColorSchemePreference;
  resolvedScheme: ResolvedColorScheme;
  setColorSchemePreference: (preference: ColorSchemePreference) => void;
};

const StaffThemeContext = createContext<StaffTheme>({
  colors: gwadaColorsLight,
  preference: "system",
  resolvedScheme: "light",
  setColorSchemePreference: () => {},
});

export function StaffThemeProvider({ children }: { children: ReactNode }) {
  const restaurants = useAuthStore((s) => s.restaurants);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const preference = useAppearanceStore((s) => s.preference);
  const hydrated = useAppearanceStore((s) => s.hydrated);
  const initAppearance = useAppearanceStore((s) => s.init);
  const setPreference = useAppearanceStore((s) => s.setPreference);
  const systemScheme = useColorScheme();

  useEffect(() => {
    if (!hydrated) void initAppearance();
  }, [hydrated, initAppearance]);

  const resolvedScheme = useMemo(
    () =>
      resolveColorScheme(
        preference,
        systemScheme === "dark" ? "dark" : "light",
      ),
    [preference, systemScheme],
  );

  const colors = useMemo(() => {
    const active = restaurants.find((r) => r.restaurantId === activeRestaurantId);
    return resolveGwadaColors(resolvedScheme, active?.brandAccentHex);
  }, [restaurants, activeRestaurantId, resolvedScheme]);

  const setColorSchemePreference = useCallback(
    (next: ColorSchemePreference) => {
      void setPreference(next);
    },
    [setPreference],
  );

  const value = useMemo(
    () => ({
      colors,
      preference,
      resolvedScheme,
      setColorSchemePreference,
    }),
    [colors, preference, resolvedScheme, setColorSchemePreference],
  );

  return (
    <StaffThemeContext.Provider value={value}>
      {children}
    </StaffThemeContext.Provider>
  );
}

export function useStaffTheme(): StaffTheme {
  return useContext(StaffThemeContext);
}

export function ThemedStatusBar() {
  const { resolvedScheme } = useStaffTheme();
  return <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />;
}
