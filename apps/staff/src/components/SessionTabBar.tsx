import { Pressable, StyleSheet, Text, View } from "react-native";
import { gwadaColors, gwadaRadii } from "@/src/theme/tokens";

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
  tab: {
    flex: 1,
    borderRadius: gwadaRadii.button,
    backgroundColor: gwadaColors.surface,
    borderWidth: 1,
    borderColor: gwadaColors.border,
    overflow: "hidden",
  },
  tabActive: {
    backgroundColor: gwadaColors.accent,
    borderColor: gwadaColors.accent,
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: gwadaColors.textMuted,
  },
  tabTextActive: {
    color: gwadaColors.accentForeground,
  },
});
