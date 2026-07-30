"use client";

import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  DrawerFilterHeader,
  DrawerFilterSwitchRow,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CONTACT_MESSAGE_PLATFORM_ORDER,
  type ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import {
  CONTACT_TIMELINE_MESSAGE_PLATFORM_OPTIONS,
  resetContactTimelineFilter,
  type ContactTimelineFilter,
} from "@/lib/constants/contact-timeline-filter";
import { cn } from "@/lib/utils";

type ContactTimelineFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: ContactTimelineFilter;
  onFilterChange: (filter: ContactTimelineFilter) => void;
  stackZClass?: string;
};

function toggleMessagePlatform(
  filter: ContactTimelineFilter,
  platform: ContactMessagePlatform,
  checked: boolean,
): ContactTimelineFilter {
  const next = new Set(filter.messagePlatforms);
  if (checked) next.add(platform);
  else next.delete(platform);
  return {
    ...filter,
    messagePlatforms: CONTACT_MESSAGE_PLATFORM_ORDER.filter((p) => next.has(p)),
  };
}

export function ContactTimelineFilterDrawer({
  open,
  onOpenChange,
  filter,
  onFilterChange,
  stackZClass,
}: ContactTimelineFilterDrawerProps) {
  const reset = () => onFilterChange(resetContactTimelineFilter());

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent
        overlayClassName={stackZClass}
        className={cn(drawerContentClassName("filter"), stackZClass)}
      >
        <DrawerFilterHeader title="Filter" />
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            <DrawerFilterSwitchRow>
              <Label htmlFor="timeline-filter-reservations" className="text-sm font-medium">
                Reservierungen
              </Label>
              <Switch
                id="timeline-filter-reservations"
                checked={filter.showReservations}
                onCheckedChange={(checked) =>
                  onFilterChange({
                    ...filter,
                    showReservations: checked === true,
                  })
                }
                aria-label="Reservierungen anzeigen"
              />
            </DrawerFilterSwitchRow>
            <DrawerFilterSwitchRow>
              <Label htmlFor="timeline-filter-messages" className="text-sm font-medium">
                Nachrichten
              </Label>
              <Switch
                id="timeline-filter-messages"
                checked={filter.showMessages}
                onCheckedChange={(checked) =>
                  onFilterChange({
                    ...filter,
                    showMessages: checked === true,
                  })
                }
                aria-label="Nachrichten anzeigen"
              />
            </DrawerFilterSwitchRow>
            <DrawerFilterSwitchRow>
              <Label htmlFor="timeline-filter-notes" className="text-sm font-medium">
                Notizen
              </Label>
              <Switch
                id="timeline-filter-notes"
                checked={filter.showNotes}
                onCheckedChange={(checked) =>
                  onFilterChange({
                    ...filter,
                    showNotes: checked === true,
                  })
                }
                aria-label="Notizen anzeigen"
              />
            </DrawerFilterSwitchRow>

            {filter.showMessages
              ? CONTACT_TIMELINE_MESSAGE_PLATFORM_OPTIONS.map(({ platform, label }) => {
                  const checked = filter.messagePlatforms.includes(platform);
                  const inputId = `timeline-filter-platform-${platform}`;
                  return (
                    <DrawerFilterSwitchRow key={platform}>
                      <Label htmlFor={inputId} className="text-sm font-medium">
                        {label}
                      </Label>
                      <Checkbox
                        id={inputId}
                        checked={checked}
                        onCheckedChange={(value) =>
                          onFilterChange(
                            toggleMessagePlatform(filter, platform, value === true),
                          )
                        }
                        aria-label={label}
                      />
                    </DrawerFilterSwitchRow>
                  );
                })
              : null}
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter onReset={reset} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
