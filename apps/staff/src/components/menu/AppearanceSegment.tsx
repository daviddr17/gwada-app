import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { useStaffTheme } from "@/src/theme/staff-theme";
import type { ColorSchemePreference } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";
import { StyleSheet, View } from "react-native";

const OPTIONS = [
  { id: "light" as const, label: "Hell" },
  { id: "dark" as const, label: "Dunkel" },
  { id: "system" as const, label: "System" },
];

export function AppearanceSegment() {
  const { preference, setColorSchemePreference } = useStaffTheme();

  return (
    <View style={styles.wrap}>
      <SegmentedControl<ColorSchemePreference>
        options={OPTIONS}
        value={preference}
        onChange={setColorSchemePreference}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
