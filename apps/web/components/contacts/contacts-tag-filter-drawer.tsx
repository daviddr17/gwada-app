"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  CONTACT_TAG_FILTER_ALL,
  CONTACT_TAG_FILTER_UNTAGGED,
  type ContactTagFilterValue,
} from "@/lib/constants/contact-tag-presets";
import type { ContactTagRow } from "@/lib/supabase/contact-tags-db";
import { drawerFormFieldClassName } from "@/lib/ui/drawer-form-section";

type ContactsTagFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagFilter: ContactTagFilterValue;
  onTagFilterChange: (value: ContactTagFilterValue) => void;
  tags: ContactTagRow[];
};

export function countContactsTagActiveFilters(
  tagFilter: ContactTagFilterValue,
): number {
  return tagFilter === CONTACT_TAG_FILTER_ALL ? 0 : 1;
}

export function ContactsTagFilterDrawer({
  open,
  onOpenChange,
  tagFilter,
  onTagFilterChange,
  tags,
}: ContactsTagFilterDrawerProps) {
  const options = useMemo(
    () => [
      { value: CONTACT_TAG_FILTER_ALL, label: "Alle Tags" },
      { value: CONTACT_TAG_FILTER_UNTAGGED, label: "Ohne Tag" },
      ...tags.map((t) => ({
        value: t.id,
        label: t.name,
        leadingColor: t.background_color,
      })),
    ],
    [tags],
  );

  const reset = () => onTagFilterChange(CONTACT_TAG_FILTER_ALL);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Kontakte nach Tag einschränken.
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormBody>
            <DrawerFormSection title="Tag">
              <SearchableSelect
                value={tagFilter}
                onValueChange={(v) => onTagFilterChange(v as ContactTagFilterValue)}
                options={options}
                className={appSelectTriggerAccentCn(drawerFormFieldClassName)}
                placeholder="Tag wählen"
              />
            </DrawerFormSection>
          </DrawerFormBody>
        </div>
        <DrawerFilterFooter onReset={reset} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
