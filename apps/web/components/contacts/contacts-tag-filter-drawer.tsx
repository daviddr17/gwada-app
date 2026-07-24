"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormFieldClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  CONTACT_TAG_FILTER_ALL,
  CONTACT_TAG_FILTER_UNTAGGED,
  type ContactTagFilterValue,
} from "@/lib/constants/contact-tag-presets";
import type { ContactTagRow } from "@/lib/supabase/contact-tags-db";

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
        <DrawerFilterHeader title="Filter" />
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            <DrawerFilterField label="Tag">
              <SearchableSelect
                value={tagFilter}
                onValueChange={(v) => onTagFilterChange(v as ContactTagFilterValue)}
                options={options}
                className={appSelectTriggerAccentCn(drawerFormFieldClassName)}
                placeholder="Tag wählen"
              />
            </DrawerFilterField>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter onReset={reset} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
