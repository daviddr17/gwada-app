"use client";

import { SuperadminFoodMarkingsPanel } from "@/components/superadmin/superadmin-food-markings-panel";

export default function SuperadminKennzeichnungenPage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Länderspezifische Zusatzstoff- und Allergenlisten für die Speisekarte
        (`marking_codes` an Zutaten und Gerichten).
      </p>
      <SuperadminFoodMarkingsPanel />
    </div>
  );
}
