import { useMemo, type DependencyList } from "react";
import { useStaffTheme } from "@/src/theme/staff-theme";
import type { GwadaColors } from "@/src/theme/tokens";

export function useThemedStyles<T>(
  factory: (colors: GwadaColors) => T,
  deps: DependencyList = [],
): T {
  const { colors } = useStaffTheme();
  return useMemo(() => factory(colors), [colors, ...deps]);
}
