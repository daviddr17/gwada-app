import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { staffTabIconOptions } from "@/src/navigation/tab-bar-config";
import { useStaffPermissions } from "@/src/lib/hooks/use-staff-permissions";
import { useStaffTheme } from "@/src/theme/staff-theme";

export default function TabLayout() {
  const { colors } = useStaffTheme();
  const { has } = useStaffPermissions();
  const showKasse = has("pos.kasse.manage") || has("pos.kasse.export");

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
      <Tabs.Screen name="orders" options={staffTabIconOptions("orders")} />
      <Tabs.Screen
        name="kasse"
        options={{
          ...staffTabIconOptions("kasse"),
          href: showKasse ? undefined : null,
        }}
      />
      <Tabs.Screen name="menu" options={staffTabIconOptions("menu")} />
    </Tabs>
  );
}
