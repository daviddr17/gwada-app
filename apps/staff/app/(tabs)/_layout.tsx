import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { staffTabIconOptions } from "@/src/navigation/tab-bar-config";
import { useStaffTheme } from "@/src/theme/staff-theme";

export default function TabLayout() {
  const { colors } = useStaffTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator,
          borderTopWidth: Platform.OS === "ios" ? StyleSheet.hairlineWidth : 1,
        },
      }}
    >
      <Tabs.Screen name="tables" options={staffTabIconOptions("tables")} />
      <Tabs.Screen
        name="reservations"
        options={staffTabIconOptions("reservations")}
      />
      <Tabs.Screen name="orders" options={staffTabIconOptions("orders")} />
      <Tabs.Screen name="menu" options={staffTabIconOptions("menu")} />
    </Tabs>
  );
}
