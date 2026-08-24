"use client";

import { useEffect, useMemo, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  DatePickerField,
  formScheduleTimeInputFullWidthClassName,
} from "@/components/ui/date-picker";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DrawerFormBody,
  DrawerFormSection,
} from "@/components/ui/drawer-form-section";
import { drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  datetimeLocalValueToIso,
  datetimeLocalValueToYmdHm,
  isoToDatetimeLocalValue,
  ymdAndHmToDatetimeLocal,
} from "@/lib/reservations/datetime-local";
import { fetchStaffForRestaurant } from "@/lib/supabase/staff-db";
import { staffDisplayName } from "@/lib/types/staff";
import { CONTACT_INBOX_STACKED_SHEET_Z_INDEX } from "@/components/contacts/contact-inbox-thread-overlay";

function ymdHmToIso(ymd: string, hm: string): string | null {
  if (!ymd.trim()) return null;
  return datetimeLocalValueToIso(ymdAndHmToDatetimeLocal(ymd, hm || "09:00"));
}

function isoToYmdHm(iso: string | null | undefined): { ymd: string; hm: string } {
  if (!iso) return { ymd: "", hm: "09:00" };
  return datetimeLocalValueToYmdHm(isoToDatetimeLocalValue(iso));
}

export type InboxFollowUpSheetValues = {
  reason: string | null;
  remindAt: string | null;
  staffId: string | null;
};

type InboxFollowUpSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  contactDisplayName: string;
  initial?: InboxFollowUpSheetValues | null;
  saving?: boolean;
  stackAboveInboxOverlay?: boolean;
  onSave: (values: InboxFollowUpSheetValues) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
};

export function InboxFollowUpSheet({
  open,
  onOpenChange,
  restaurantId,
  contactDisplayName,
  initial = null,
  saving = false,
  stackAboveInboxOverlay = false,
  onSave,
  onClear,
}: InboxFollowUpSheetProps) {
  const [reason, setReason] = useState("");
  const [remindYmd, setRemindYmd] = useState("");
  const [remindHm, setRemindHm] = useState("09:00");
  const [staffId, setStaffId] = useState("");
  const [staff, setStaff] = useState<{ id: string; label: string }[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(initial?.reason ?? "");
    const remind = isoToYmdHm(initial?.remindAt);
    setRemindYmd(remind.ymd);
    setRemindHm(remind.hm || "09:00");
    setStaffId(initial?.staffId?.trim() || "__none__");
  }, [open, initial]);

  useEffect(() => {
    if (!open || !restaurantId) {
      setStaff([]);
      return;
    }
    let cancelled = false;
    setLoadingStaff(true);
    void fetchStaffForRestaurant(restaurantId).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setStaff([]);
      } else {
        setStaff(
          data
            .filter((row) => row.is_active)
            .map((row) => ({
              id: row.id,
              label: staffDisplayName(row),
            })),
        );
      }
      setLoadingStaff(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId]);

  const staffOptions = useMemo(
    () => [
      { value: "__none__", label: "Niemand" },
      ...staff.map((s) => ({ value: s.id, label: s.label })),
    ],
    [staff],
  );

  const handleSave = () => {
    void onSave({
      reason: reason.trim() || null,
      remindAt: ymdHmToIso(remindYmd, remindHm),
      staffId:
        !staffId.trim() || staffId === "__none__" ? null : staffId.trim(),
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className={drawerContentClassName("form")}
        style={
          stackAboveInboxOverlay
            ? { zIndex: CONTACT_INBOX_STACKED_SHEET_Z_INDEX }
            : undefined
        }
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Später erledigen
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            {contactDisplayName
              ? `Chat mit ${contactDisplayName}`
              : "Chat für später markieren"}
            {" — "}
            Grund, Reminder und Mitarbeiter sind optional.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerFormBody>
          <DrawerFormSection title="Grund (optional)">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="z. B. Rückruf, Tisch klären, Angebot schicken …"
              className="min-h-24 rounded-xl"
              maxLength={500}
            />
          </DrawerFormSection>

          <DrawerFormSection title="Erinnerung (optional)">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Datum</Label>
                <DatePickerField
                  fullWidth
                  value={remindYmd || null}
                  onChange={(d) => setRemindYmd(d ?? "")}
                  placeholder="Kein Reminder"
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Uhrzeit</Label>
                <Input
                  type="time"
                  value={remindHm}
                  onChange={(e) => setRemindHm(e.target.value)}
                  disabled={!remindYmd}
                  className={formScheduleTimeInputFullWidthClassName}
                />
              </div>
            </div>
          </DrawerFormSection>

          <DrawerFormSection title="Mitarbeiter zuweisen (optional)">
            <p className="mb-2 text-xs text-muted-foreground">
              Erstellt ein Todo unter Checklisten für die Bearbeitung.
            </p>
            <SearchableSelect
              value={staffId}
              onValueChange={setStaffId}
              options={staffOptions}
              disabled={loadingStaff || !restaurantId}
              placeholder={loadingStaff ? "Laden …" : "Mitarbeiter wählen"}
              className={appSelectTriggerAccentCn("h-11 w-full rounded-xl")}
            />
          </DrawerFormSection>
        </DrawerFormBody>

        <DrawerFormFooter
          cancelLabel={onClear ? "Erledigt" : "Abbrechen"}
          onCancel={() => {
            if (onClear) void onClear();
            else onOpenChange(false);
          }}
          cancelDisabled={saving}
          submitLabel="Speichern"
          submitType="button"
          onSubmit={handleSave}
          submitPending={saving}
          submitDisabled={saving || !restaurantId}
          contentPadding={6}
        />
      </DrawerContent>
    </Drawer>
  );
}
