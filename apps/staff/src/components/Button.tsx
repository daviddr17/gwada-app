import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  type PressableProps,
} from "react-native";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type ButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = "primary",
  loading,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useStaffTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && { backgroundColor: colors.accent },
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "primary" ? colors.accentForeground : colors.accent
          }
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary" && { color: colors.accentForeground },
            variant === "secondary" && styles.labelSecondary,
            variant === "ghost" && { color: colors.accent },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: gwadaRadii.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: gwadaSpacing.md,
  },
  secondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  labelSecondary: {
    color: "#0a0a0a",
  },
});
