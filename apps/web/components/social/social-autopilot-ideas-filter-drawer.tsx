"use client";

import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import {
  availableSocialAutopilotIdeaFilters,
  SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS,
  type SocialAutopilotIdeaFilter,
} from "@/lib/social/social-autopilot-idea-sort";
import type { SocialAutopilotIdea } from "@/lib/social/social-autopilot-ideas";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const selectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

export function countAutopilotIdeaActiveFilters(
  filter: SocialAutopilotIdeaFilter,
): number {
  return filter === "all" ? 0 : 1;
}

export function SocialAutopilotIdeasFilterDrawer({
  open,
  onOpenChange,
  ideas,
  filter,
  onFilterChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideas: SocialAutopilotIdea[];
  filter: SocialAutopilotIdeaFilter;
  onFilterChange: (value: SocialAutopilotIdeaFilter) => void;
}) {
  const options = availableSocialAutopilotIdeaFilters(ideas).map((value) => ({
    value,
    label: SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS[value],
  }));

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("template")}>
        <DrawerFilterHeader title="Quellen" />
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            <DrawerFilterField label="Anzeigen">
              <SearchableSelect
                value={filter}
                onValueChange={(v) =>
                  onFilterChange((v as SocialAutopilotIdeaFilter) || "all")
                }
                options={options}
                placeholder="Quelle"
                className={selectClassName}
                side="top"
                aria-label="Quellen filtern"
              />
            </DrawerFilterField>
            <p className="text-sm text-muted-foreground">
              Speisekarte, Galerie und KI-Ideen — alles optional.
            </p>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter
          onReset={() => {
            onFilterChange("all");
            toast.success("Zurückgesetzt");
          }}
          onDone={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
