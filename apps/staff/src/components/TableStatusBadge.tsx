import { StyleSheet, Text, View } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii } from "@/src/theme/tokens";

export type TableStatusVariant = "free" | "occupied" | "reserved";

type TableStatusBadgeProps = {
  variant: TableStatusVariant;
  label: string;
};

export function TableStatusBadge({ variant, label }: TableStatusBadgeProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[
        styles.badge,
        variant === "free" && styles.free,
        variant === "occupied" && styles.occupied,
        variant === "reserved" && styles.reserved,
      ]}
    >
      <Text
        allowFontScaling
        style={[
          styles.text,
          variant === "free" && styles.textFree,
          variant === "occupied" && styles.textOccupied,
          variant === "reserved" && styles.textReserved,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    badge: {
      minHeight: 28,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: gwadaRadii.pill,
      justifyContent: "center",
    },
    free: {
      backgroundColor: colors.successMuted,
    },
    occupied: {
      backgroundColor: colors.occupiedMuted,
    },
    reserved: {
      backgroundColor: colors.warningMuted,
    },
    text: {
      fontSize: 12,
      fontWeight: "600",
    },
    textFree: {
      color: colors.success,
    },
    textOccupied: {
      color: colors.occupied,
    },
    textReserved: {
      color: colors.warning,
    },
  });
}
