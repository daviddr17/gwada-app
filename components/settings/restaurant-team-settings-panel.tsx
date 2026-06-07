"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RestaurantRolesPanel } from "@/components/settings/restaurant-roles-panel";
import { RestaurantTeamPanel } from "@/components/settings/restaurant-team-panel";

export function RestaurantTeamSettingsPanel() {
  return (
    <div className="flex flex-col gap-6 pb-4">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Rollen</CardTitle>
          <CardDescription>
            Positionen und Berechtigungen für dein Team — z. B. wer WhatsApp
            verbinden oder Rollen bearbeiten darf.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RestaurantRolesPanel />
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Team</CardTitle>
          <CardDescription>
            Mitglieder des aktuell aktiven Restaurants. Wer die Berechtigung{" "}
            <span className="font-medium text-foreground">Team verwalten</span>{" "}
            hat, kann Rollen anpassen und Zugang entziehen. Es muss immer
            mindestens ein aktiver Inhaber existieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RestaurantTeamPanel embedded />
        </CardContent>
      </Card>
    </div>
  );
}
