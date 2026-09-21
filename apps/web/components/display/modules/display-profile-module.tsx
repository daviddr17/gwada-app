"use client";

import { useState } from "react";
import { DisplayProfileDocumentsPanel } from "@/components/display/modules/display-profile-documents-panel";
import { DisplayProfileStammdatenPanel } from "@/components/display/modules/display-profile-stammdaten-panel";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import { displayFilterChipClassName } from "@/lib/ui/display-filter-chip";
import { cn } from "@/lib/utils";

type DisplayProfileTab = "profil" | "dokumente";

const PROFILE_TABS: { id: DisplayProfileTab; label: string }[] = [
  { id: "profil", label: "Profil" },
  { id: "dokumente", label: "Dokumente" },
];

export function DisplayProfileModule({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const [tab, setTab] = useState<DisplayProfileTab>("profil");

  return (
    <div className={cn(displayModuleContentClassName, "space-y-4")}>
      <div className="flex flex-wrap gap-2">
        {PROFILE_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={displayFilterChipClassName(tab === item.id)}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "profil" ? (
        <DisplayProfileStammdatenPanel />
      ) : (
        <DisplayProfileDocumentsPanel restaurantId={restaurantId} />
      )}
    </div>
  );
}
