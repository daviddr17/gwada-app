import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii } from "@/src/theme/tokens";

export type SessionTab = "orders" | "payments";

type SessionTabBarProps = {
  active: SessionTab;
  onChange: (tab: SessionTab) => void;
  paymentCount?: number;
};

function SessionTabButton({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      style={[styles.tab, isActive && styles.tabActive]}
      onPress={onPress}
    >
      <View style={styles.tabInner}>
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function SessionTabBar({
  active,
  onChange,
  paymentCount,
}: SessionTabBarProps) {
  const paymentsLabel =
    paymentCount != null && paymentCount > 0
      ? `Zahlungen (${paymentCount})`
      : "Zahlungen";

  return (
    <View style={styles.tabs}>
      <SessionTabButton
        label="Bestellungen"
        isActive={active === "orders"}
        onPress={() => onChange("orders")}
      />
      <SessionTabButton
        label={paymentsLabel}
        isActive={active === "payments"}
        onPress={() => onChange("payments")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: 10,
  },
});

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    tab: {
      flex: 1,
      borderRadius: gwadaRadii.button,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    tabActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    tabInner: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.accentForeground,
    },
  });
}
