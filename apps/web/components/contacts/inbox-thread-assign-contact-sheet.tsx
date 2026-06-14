"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  contactDisplayName,
  fetchContactsForRestaurant,
  type ContactListRow,
} from "@/lib/supabase/contacts-db";
import { cn } from "@/lib/utils";

type InboxThreadAssignContactSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  threadDisplayName: string;
  assigning?: boolean;
  onAssign: (contactId: string, contactLabel: string) => void | Promise<void>;
};

export function InboxThreadAssignContactSheet({
  open,
  onOpenChange,
  restaurantId,
  threadDisplayName,
  assigning = false,
  onAssign,
}: InboxThreadAssignContactSheetProps) {
  const [contacts, setContacts] = useState<ContactListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!open || !restaurantId) {
      setSelectedId("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchContactsForRestaurant(restaurantId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setContacts([]);
      } else {
        setContacts(data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, restaurantId]);

  const options = useMemo(
    () =>
      contacts.map((c) => ({
        value: c.id,
        label: contactDisplayName(c),
      })),
    [contacts],
  );

  const selectedLabel =
    options.find((o) => o.value === selectedId)?.label ?? "";

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,480px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Kontakt zuordnen
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Chat „{threadDisplayName}“ einem bestehenden Kontakt zuweisen.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
          <div className="space-y-2">
            <Label>Kontakt</Label>
            <SearchableSelect
              value={selectedId}
              onValueChange={setSelectedId}
              options={options}
              placeholder={
                loading
                  ? "Kontakte werden geladen …"
                  : options.length
                    ? "Kontakt suchen …"
                    : "Keine Kontakte vorhanden"
              }
              disabled={loading || assigning || options.length === 0}
              className={appSelectTriggerAccentCn("h-11 w-full")}
            />
          </div>

          <Button
            type="button"
            className={cn("h-11 w-full", brandActionButtonRoundedClassName)}
            disabled={!selectedId || assigning || loading}
            onClick={() => {
              if (!selectedId) return;
              void onAssign(selectedId, selectedLabel);
            }}
          >
            {assigning ? "Wird zugeordnet …" : "Zuordnen"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
