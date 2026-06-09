import { Pressable, StyleSheet, Text, View } from "react-native";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { ColorSchemePreference, GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

const OPTIONS: { id: ColorSchemePreference; label: string }[] = [
  { id: "light", label: "Hell" },
  { id: "dark", label: "Dunkel" },
  { id: "system", label: "System" },
];

export function AppearanceSegment() {
  const { preference, setColorSchemePreference } = useStaffTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const active = preference === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => setColorSchemePreference(option.id)}
            style={[
              styles.segment,
              active && styles.segmentActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: gwadaSpacing.xs,
      backgroundColor: colors.background,
      borderRadius: gwadaRadii.button,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: gwadaRadii.button - 2,
    },
    segmentActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    segmentTextActive: {
      color: colors.text,
    },
  });
}
