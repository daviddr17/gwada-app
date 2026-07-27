import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing, screenTypography } from "@/src/theme/tokens";
import { listRowMinHeight } from "@/src/theme/list-styles";

type FormTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function FormTextField({
  label,
  error,
  style,
  secureTextEntry,
  value,
  editable,
  ...rest
}: FormTextFieldProps) {
  const { colors } = useStaffTheme();
  const styles = useThemedStyles(createStyles);
  const [visible, setVisible] = useState(false);
  const hasValue =
    typeof value === "string"
      ? value.length > 0
      : value != null && String(value).length > 0;
  const canToggle =
    Boolean(secureTextEntry) && hasValue && editable !== false;

  return (
    <View style={styles.wrap}>
      <Text allowFontScaling style={styles.label}>
        {label}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          {...rest}
          allowFontScaling
          placeholderTextColor={colors.textMuted}
          style={[styles.input, canToggle ? styles.inputWithToggle : null, style]}
          secureTextEntry={Boolean(secureTextEntry) && !(visible && canToggle)}
          value={value}
          editable={editable}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              canToggle
                ? visible
                  ? "Eingabe verbergen"
                  : "Eingabe anzeigen"
                : "Nichts anzuzeigen"
            }
            disabled={!canToggle}
            hitSlop={8}
            onPress={() => {
              if (canToggle) setVisible((v) => !v);
            }}
            style={styles.toggle}
          >
            <Ionicons
              name={visible && canToggle ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={canToggle ? colors.textMuted : colors.border}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text allowFontScaling style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: gwadaSpacing.md,
      paddingVertical: 10,
      minHeight: listRowMinHeight,
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    input: {
      ...screenTypography.rowLabel,
      color: colors.text,
      padding: 0,
      minHeight: 24,
      flex: 1,
    },
    inputWithToggle: {
      paddingRight: 4,
    },
    toggle: {
      padding: 2,
    },
    error: {
      fontSize: 13,
      color: colors.destructive,
    },
  });
}
