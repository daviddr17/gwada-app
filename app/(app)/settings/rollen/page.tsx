import { RestaurantRolesPanel } from "@/components/settings/restaurant-roles-panel";

export default function SettingsRollenPage() {
  return (
    <div className="space-y-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Rollen</h2>
        <p className="text-sm text-muted-foreground">
          Positionen und Berechtigungen für dein Team — z. B. wer WhatsApp
          verbinden oder Rollen bearbeiten darf.
        </p>
      </div>
      <RestaurantRolesPanel />
    </div>
  );
}
