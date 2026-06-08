import { Tabs } from "expo-router";
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
      }}
    >
      <Tabs.Screen name="tables" options={{ title: "Tische" }} />
      <Tabs.Screen name="orders" options={{ title: "Bestellungen" }} />
      <Tabs.Screen
        name="kasse"
        options={{
          title: "Kasse",
          href: showKasse ? undefined : null,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: "Einstellungen" }} />
    </Tabs>
  );
}
