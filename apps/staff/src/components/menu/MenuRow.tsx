import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

type MenuRowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  children?: React.ReactNode;
};

export function MenuRow({ label, value, onPress, children }: MenuRowProps) {
  const styles = useThemedStyles(createStyles);

  if (children) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        {children}
      </View>
    );
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        <Text style={styles.label}>{label}</Text>
        {value ? <Text style={styles.value}>{value}</Text> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.static}>
      <Text style={styles.label}>{label}</Text>
      {value ? <Text style={styles.value}>{value}</Text> : null}
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      gap: gwadaSpacing.sm,
    },
    static: {
      gap: 4,
    },
    pressable: {
      gap: 4,
      paddingVertical: 2,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
    },
    value: {
      fontSize: 16,
      color: colors.text,
    },
  });
}
