import { Tabs } from "expo-router";
import { gwadaColors } from "@/src/theme/tokens";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: gwadaColors.accent,
        tabBarInactiveTintColor: gwadaColors.textMuted,
      }}
    >
      <Tabs.Screen name="tables" options={{ title: "Tische" }} />
      <Tabs.Screen name="orders" options={{ title: "Bestellungen" }} />
      <Tabs.Screen name="settings" options={{ title: "Einstellungen" }} />
    </Tabs>
  );
}
