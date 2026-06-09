import * as Haptics from "expo-haptics";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import SegmentedControlIOS from "@react-native-segmented-control/segmented-control";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type SegmentedControlProps<T extends string> = {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const styles = useThemedStyles(createStyles);
  const labels = options.map((o) => o.label);
  const selectedIndex = options.findIndex((o) => o.id === value);

  if (Platform.OS === "ios") {
    return (
      <SegmentedControlIOS
        values={labels}
        selectedIndex={selectedIndex < 0 ? 0 : selectedIndex}
        onChange={(event) => {
          const index = event.nativeEvent.selectedSegmentIndex;
          const option = options[index];
          if (option && option.id !== value) {
            void Haptics.selectionAsync();
            onChange(option.id);
          }
        }}
        style={styles.iosControl}
      />
    );
  }

  return (
    <View style={styles.androidRow}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => {
              if (option.id !== value) {
                void Haptics.selectionAsync();
                onChange(option.id);
              }
            }}
            style={[styles.androidSegment, active && styles.androidSegmentActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              allowFontScaling
              style={[styles.androidText, active && styles.androidTextActive]}
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
    iosControl: {
      height: 36,
    },
    androidRow: {
      flexDirection: "row",
      gap: gwadaSpacing.xs,
      backgroundColor: colors.fillSecondary,
      borderRadius: gwadaRadii.button,
      padding: 4,
    },
    androidSegment: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: gwadaRadii.button - 2,
    },
    androidSegmentActive: {
      backgroundColor: colors.surface,
    },
    androidText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    androidTextActive: {
      color: colors.text,
    },
  });
}
