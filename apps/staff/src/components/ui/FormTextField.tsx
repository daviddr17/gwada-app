import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing, screenTypography } from "@/src/theme/tokens";
import { listRowMinHeight } from "@/src/theme/list-styles";

type FormTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function FormTextField({ label, error, style, ...rest }: FormTextFieldProps) {
  const { colors } = useStaffTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <Text allowFontScaling style={styles.label}>
        {label}
      </Text>
      <TextInput
        allowFontScaling
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...rest}
      />
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
    input: {
      ...screenTypography.rowLabel,
      color: colors.text,
      padding: 0,
      minHeight: 24,
    },
    error: {
      fontSize: 13,
      color: colors.destructive,
    },
  });
}
