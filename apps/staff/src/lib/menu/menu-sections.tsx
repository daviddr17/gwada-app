import Constants from "expo-constants";
import { View } from "react-native";
import { Button } from "@/src/components/Button";
import { AppearanceSegment } from "@/src/components/menu/AppearanceSegment";
import { MenuRow } from "@/src/components/menu/MenuRow";
import { MenuSection } from "@/src/components/menu/MenuSection";
import type { MenuSectionDef } from "@/src/components/menu/MenuScreen";
import { useAuthStore } from "@/src/stores/auth-store";
import { gwadaSpacing } from "@/src/theme/tokens";

function appVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? "—";
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  const androidBuild = Constants.expoConfig?.android?.versionCode;
  const build =
    iosBuild != null
      ? String(iosBuild)
      : androidBuild != null
        ? String(androidBuild)
        : "—";
  return `${version} (${build})`;
}

function AccountSection() {
  const restaurants = useAuthStore((s) => s.restaurants);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const active = restaurants.find((r) => r.restaurantId === activeRestaurantId);

  return (
    <MenuSection title="Konto">
      <MenuRow label="Angemeldet als" value={session?.user.email ?? "—"} />
      <MenuRow label="Aktives Restaurant" value={active?.name ?? "—"} />
      <View style={{ gap: gwadaSpacing.sm, marginTop: gwadaSpacing.xs }}>
        <Button
          label="Restaurant wechseln"
          variant="secondary"
          onPress={() => {
            useAuthStore.setState({ activeRestaurantId: null });
          }}
        />
        <Button
          label="Abmelden"
          variant="ghost"
          onPress={() => void signOut()}
        />
      </View>
    </MenuSection>
  );
}

function AppearanceSection() {
  return (
    <MenuSection title="Erscheinungsbild">
      <AppearanceSegment />
    </MenuSection>
  );
}

function AppInfoSection() {
  return (
    <MenuSection title="App">
      <MenuRow label="Version" value={appVersionLabel()} />
    </MenuSection>
  );
}

export function useStaffMenuSections(): MenuSectionDef[] {
  return [
    {
      id: "appearance",
      render: () => <AppearanceSection />,
    },
    {
      id: "account",
      render: () => <AccountSection />,
    },
    {
      id: "app",
      render: () => <AppInfoSection />,
    },
  ];
}
