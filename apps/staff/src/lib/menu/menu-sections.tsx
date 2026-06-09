import Constants from "expo-constants";
import { AppearanceSegment } from "@/src/components/menu/AppearanceSegment";
import { MenuRow } from "@/src/components/menu/MenuRow";
import type { MenuSectionDef } from "@/src/components/menu/MenuScreen";
import { MenuSection } from "@/src/components/menu/MenuSection";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { useAuthStore } from "@/src/stores/auth-store";

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
      <MenuRow
        label="Angemeldet als"
        value={session?.user.email ?? "—"}
        variant="value"
      />
      <ListSeparator />
      <MenuRow label="Aktives Restaurant" value={active?.name ?? "—"} variant="value" />
      <ListSeparator />
      <MenuRow
        label="Restaurant wechseln"
        variant="navigation"
        onPress={() => {
          useAuthStore.setState({ activeRestaurantId: null });
        }}
      />
      <ListSeparator />
      <MenuRow
        label="Abmelden"
        variant="destructive"
        onPress={() => void signOut()}
      />
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
      <MenuRow label="Version" value={appVersionLabel()} variant="value" />
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
