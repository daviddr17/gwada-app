import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing, screenTypography } from "@/src/theme/tokens";
import { listRowMinHeight } from "@/src/theme/list-styles";

export type ListRowVariant = "static" | "value" | "navigation" | "destructive";

type ListRowProps = {
  label: string;
  value?: string;
  variant?: ListRowVariant;
  onPress?: () => void;
  showSeparator?: boolean;
  accessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function ListRow({
  label,
  value,
  variant = value ? "value" : "static",
  onPress,
  accessory,
  style,
  children,
}: ListRowProps) {
  const styles = useThemedStyles(createStyles);
  const resolvedVariant = variant === "static" && onPress ? "navigation" : variant;
  const isDestructive = resolvedVariant === "destructive";
  const isNavigation = resolvedVariant === "navigation";
  const showChevron = isNavigation && !accessory;

  const content = (
    <View style={[styles.row, isDestructive && styles.destructiveRow, style]}>
      {children ? (
        <View style={styles.custom}>{children}</View>
      ) : isDestructive ? (
        <Text allowFontScaling style={styles.destructiveLabel} numberOfLines={1}>
          {label}
        </Text>
      ) : (
        <>
          <Text
            allowFontScaling
            style={[styles.label, isNavigation && styles.labelFlex]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {value ? (
            <Text allowFontScaling style={styles.value} numberOfLines={2}>
              {value}
            </Text>
          ) : null}
          {accessory}
          {showChevron ? (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={styles.chevronColor.color}
              style={styles.chevron}
            />
          ) : null}
        </>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    row: {
      minHeight: listRowMinHeight,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: gwadaSpacing.md,
      paddingVertical: 12,
      gap: gwadaSpacing.sm,
    },
    label: {
      ...screenTypography.rowLabel,
      color: colors.text,
      flexShrink: 0,
    },
    labelFlex: {
      flex: 1,
    },
    value: {
      ...screenTypography.rowValue,
      color: colors.textMuted,
      flex: 1,
      textAlign: "right",
    },
    destructiveRow: {
      justifyContent: "center",
    },
    destructiveLabel: {
      ...screenTypography.rowLabel,
      color: colors.destructive,
      textAlign: "center",
      flex: 1,
    },
    chevron: {
      marginLeft: 2,
    },
    chevronColor: {
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.7,
    },
    custom: {
      flex: 1,
    },
  });
}
