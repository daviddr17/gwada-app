import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { AppearanceSegment } from "@/src/components/menu/AppearanceSegment";
import { MenuRow } from "@/src/components/menu/MenuRow";
import type { MenuSectionDef } from "@/src/components/menu/MenuScreen";
import { MenuSection } from "@/src/components/menu/MenuSection";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { useStaffPermissions } from "@/src/lib/hooks/use-staff-permissions";
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
  const router = useRouter();
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
        onPress={() => router.push("/restaurant-select")}
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

function OperationsSection() {
  const router = useRouter();
  const { has } = useStaffPermissions();
  const showKasse = has("pos.kasse.manage") || has("pos.kasse.export");

  if (!showKasse) return null;

  return (
    <MenuSection title="Betrieb">
      <MenuRow
        label="Kasse"
        variant="navigation"
        onPress={() => router.push("/kasse")}
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
      id: "operations",
      render: () => <OperationsSection />,
    },
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
