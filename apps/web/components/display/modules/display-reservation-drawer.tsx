"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  displayDrawerFormFieldClassName,
  displayDrawerFormFooterButtonClassName,
  displayDrawerFormSwitchRowClassName,
  drawerFormFieldGroupClassName,
  drawerFormRowStackClassName,
  drawerScrollAreaClassName,
  drawerFormHeaderClassName,
} from "@/lib/ui/drawer-form-section";
import { useDrawerFormKeyboardAssist } from "@/lib/hooks/use-drawer-form-keyboard-assist";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import {
  displayTouchNumericInputProps,
  displayTouchPhoneLocalInputMode,
  digitsOnlyInput,
} from "@/lib/ui/touch-numeric-input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TermsGlyph } from "@/components/icons/terms-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import { DatePickerField, formScheduleTimeInputFullWidthClassName } from "@/components/ui/date-picker";
import { useDisplayRestaurantTimezone } from "@/components/display/display-restaurant-timezone-provider";
import { GuestPhoneField } from "@/components/phone/guest-phone-field";
import { ReservationAccessMeta } from "@/components/reservations/reservation-access-meta";
import { ReservationStatusLabel } from "@/components/reservations/reservation-status-label";
import { Mail } from "lucide-react";
import {
  COUNTRIES_REFERENCE_FALLBACK,
  type CountryReference,
} from "@/lib/constants/countries";
import { fetchCountries } from "@/lib/supabase/countries-db";
import { formatGuestPhone } from "@/lib/phone/guest-phone";
import {
  minutesToHHmm,
} from "@/lib/reservations/day-opening-slots";
import {
  normalizeBookingTimeStepMinutes,
  snapMinutesToBookingStep,
  type BookingTimeStepMinutes,
} from "@/lib/reservations/booking-time-step";
import {
  readRestaurantZonedParts,
  restaurantTodayYmd,
} from "@/lib/restaurant/restaurant-timezone";
import { reservationAllowsTableAssignment } from "@/lib/reservations/reservation-table-assignment";
import {
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
} from "@/lib/reservations/reservation-guest-name";
import {
  formatDiningTableSelectLabel,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";
import { displayReservationSaveErrorMessage } from "@/lib/display/display-reservation-save-errors";
import {
  buildDisplayReservationSlotIso,
  resolveDisplayReservationDwellMinutes,
} from "@/lib/display/display-reservation-save-times";

type Status = { id: string; code: string; name: string; color_hex: string };

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

function defaultTimeHm(
  step: BookingTimeStepMinutes,
  timeZone: string,
  dayYmd: string,
  firstSlotMinutes?: number,
): string {
  if (dayYmd === restaurantTodayYmd(timeZone)) {
    const z = readRestaurantZonedParts(new Date(), timeZone);
    const nowMin = z.hour * 60 + z.minute;
    const snapped = snapMinutesToBookingStep(nowMin, step);
    return minutesToHHmm(snapped);
  }
  if (firstSlotMinutes != null) {
    return minutesToHHmm(firstSlotMinutes);
  }
  return "19:00";
}

export function DisplayReservationDrawer({
  open,
  onOpenChange,
  statuses,
  tables,
  defaultDwellMinutes,
  bookingTimeStepMinutes,
  nextReservationNumber,
  initialDayYmd,
  initialTimeHm,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: Status[];
  tables: DiningTableRow[];
  defaultDwellMinutes: number;
  bookingTimeStepMinutes: number;
  nextReservationNumber: number | null;
  initialDayYmd: string;
  initialTimeHm?: string;
  onCreated: (reservation?: DisplayReservationRow | null) => void;
}) {
  const timeZone = useDisplayRestaurantTimezone();
  const scrollRef = useRef<HTMLDivElement>(null);
  useDrawerFormKeyboardAssist({ open, scrollRef });
  const step = normalizeBookingTimeStepMinutes(bookingTimeStepMinutes);
  const [countries, setCountries] = useState<CountryReference[]>(
    COUNTRIES_REFERENCE_FALLBACK,
  );
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneCountryIso, setPhoneCountryIso] = useState("DE");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [dateYmd, setDateYmd] = useState("");
  const [timeHm, setTimeHm] = useState("19:00");
  const [statusId, setStatusId] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [dwellDraft, setDwellDraft] = useState("");
  const [tableId, setTableId] = useState<string>("__none__");
  const [internalNote, setInternalNote] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const coRes = await fetchCountries();
      if (coRes.data.length > 0) setCountries(coRes.data);
    })();
  }, [open]);

  useDrawerFormSeed(
    open,
    `create:${initialDayYmd}:${initialTimeHm ?? ""}`,
    () => {
      const confirmed = statuses.find((s) => s.code === "confirmed");
      setFirstName("");
      setLastName("");
      setPartySize("2");
      setDateYmd(initialDayYmd.trim() || restaurantTodayYmd(timeZone));
      const resolvedDayYmd = initialDayYmd.trim() || restaurantTodayYmd(timeZone);
      setTimeHm(
        initialTimeHm?.trim() ||
          defaultTimeHm(step, timeZone, resolvedDayYmd, undefined),
      );
      setStatusId(confirmed?.id ?? statuses[0]?.id ?? "");
      setNotifyEmail(true);
      setNotifyWhatsapp(false);
      setTermsAccepted(true);
      setDwellDraft(String(defaultDwellMinutes));
      setTableId("__none__");
      setPhoneLocal("");
      setEmail("");
      setInternalNote("");
    },
  );

  const statusItems = useMemo(
    () => statuses.map((s) => ({ value: s.id, label: s.name })),
    [statuses],
  );

  const selectedStatus = useMemo(
    () => statuses.find((s) => s.id === statusId) ?? null,
    [statuses, statusId],
  );

  const tableItems = useMemo(
    () => [
      { value: "__none__", label: "Kein Tisch" },
      ...tables.map((t) => ({
        value: t.id,
        label: formatDiningTableSelectLabel(t),
      })),
    ],
    [tables],
  );

  const tableSelectedLabel = useMemo(() => {
    const item = tableItems.find((i) => i.value === tableId);
    return item?.label ?? "Tisch";
  }, [tableItems, tableId]);

  const tableAssignmentAllowed = reservationAllowsTableAssignment(statusId, statuses);

  const hasPhone = Boolean(formatGuestPhone(phoneCountryIso, phoneLocal, countries));
  const hasEmail = Boolean(email.trim());

  const fieldClass = displayDrawerFormFieldClassName;
  const drawerTwoColClass = "grid gap-3 sm:grid-cols-2";

  const submit = async () => {
    const ps = Number.parseInt(partySize, 10);
    if (!Number.isFinite(ps) || ps < 1 || ps > 50) {
      toast.error("Personenzahl zwischen 1 und 50.");
      return;
    }
    if (!dateYmd.trim()) {
      toast.error("Bitte ein Datum wählen.");
      return;
    }
    if (!statusId) {
      toast.error("Bitte einen Status wählen.");
      return;
    }
    if (!lastName.trim()) {
      toast.error("Bitte einen Nachnamen eingeben.");
      return;
    }
    const minutesForEnd = resolveDisplayReservationDwellMinutes(
      dwellDraft,
      defaultDwellMinutes,
    );
    if (minutesForEnd == null) {
      toast.error("Verweildauer: 15–1440 Minuten.");
      return;
    }
    const slot = buildDisplayReservationSlotIso(
      dateYmd,
      timeHm,
      minutesForEnd,
      timeZone,
      step,
    );
    if (!slot) {
      toast.error("Ungültiges Datum oder Uhrzeit.");
      return;
    }
    setTimeHm(slot.snappedTime);
    const { startsIso, endsIso } = slot;

    setSaving(true);
    try {
      const res = await fetch("/api/display/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          guest_first_name: normalizeReservationGuestFirstName(firstName),
          guest_last_name: normalizeReservationGuestLastName(lastName),
          guest_phone: formatGuestPhone(phoneCountryIso, phoneLocal, countries),
          guest_email: email.trim() || null,
          party_size: ps,
          starts_at: startsIso,
          ends_at: endsIso,
          status_id: statusId,
          dining_table_id:
            tableAssignmentAllowed && tableId !== "__none__" ? tableId : null,
          dwell_minutes: minutesForEnd,
          notify_email: notifyEmail,
          notify_whatsapp: notifyWhatsapp,
          terms_accepted: termsAccepted,
          notes: internalNote.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        reservation_number?: number;
        guest_pin?: string;
        reservation?: DisplayReservationRow;
      };
      if (!res.ok) {
        toast.error(displayReservationSaveErrorMessage(data.error));
        return;
      }
      toast.success(
        data.reservation_number
          ? `Reservierung #${data.reservation_number} angelegt.${data.guest_pin ? ` Gast-PIN: ${data.guest_pin}` : ""}`
          : "Reservierung angelegt.",
      );
      onOpenChange(false);
      onCreated(data.reservation ?? null);
    } catch {
      toast.error("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("displayForm")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Neue Reservierung
          </DrawerTitle>
          <DrawerDescription className="text-base leading-relaxed">
            <ReservationAccessMeta
              reservationNumber={nextReservationNumber}
              guestPin={null}
              numberProvisional={nextReservationNumber != null}
              pinPending
            />
          </DrawerDescription>
        </DrawerHeader>

        {open ? (
          <>
            <div ref={scrollRef} className={drawerScrollAreaClassName(6)}>
              <div className={drawerFormRowStackClassName}>
              <div className={drawerTwoColClass}>
                <div className={cn("min-w-0", drawerFormFieldGroupClassName)}>
                  <Label htmlFor="disp-res-status" className="text-xs text-muted-foreground">
                    Status
                  </Label>
                  <Select
                    value={statusId}
                    items={statusItems}
                    onValueChange={(v) => {
                      if (typeof v === "string") setStatusId(v);
                    }}
                  >
                    <SelectTrigger
                      id="disp-res-status"
                      className={appSelectTriggerAccentCn(
                        "h-12 min-h-12 w-full rounded-xl px-3 text-left text-base font-normal",
                        selectValueNoShrink,
                      )}
                    >
                      {selectedStatus ? (
                        <ReservationStatusLabel status={selectedStatus} />
                      ) : (
                        <SelectValue placeholder="Status" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <ReservationStatusLabel status={s} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={drawerFormFieldGroupClassName}>
                  <Label htmlFor="disp-res-ps" className="text-xs text-muted-foreground">
                    Personen
                  </Label>
                  <Input
                    id="disp-res-ps"
                    {...displayTouchNumericInputProps}
                    value={partySize}
                    onChange={(e) =>
                      setPartySize(digitsOnlyInput(e.target.value, 2))
                    }
                    className={cn(fieldClass, "tabular-nums")}
                  />
                </div>
              </div>

              <div className={drawerTwoColClass}>
                <div className={drawerFormFieldGroupClassName}>
                  <Label className="text-xs text-muted-foreground">Datum</Label>
                  <DatePickerField
                    fullWidth
                    value={dateYmd || null}
                    onChange={(d) => {
                      if (d) setDateYmd(d);
                    }}
                    placeholder="Datum wählen"
                    className="w-full"
                  />
                </div>
                <div className={drawerFormFieldGroupClassName}>
                  <Label htmlFor="disp-res-time" className="text-xs text-muted-foreground">
                    Uhrzeit
                  </Label>
                  <input
                    id="disp-res-time"
                    type="time"
                    value={timeHm}
                    onChange={(e) => setTimeHm(e.target.value)}
                    className={formScheduleTimeInputFullWidthClassName}
                  />
                </div>
              </div>

              <div className={drawerTwoColClass}>
                <div className={drawerFormFieldGroupClassName}>
                  <Label htmlFor="disp-res-fn" className="text-xs text-muted-foreground">
                    Vorname
                  </Label>
                  <Input
                    id="disp-res-fn"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className={drawerFormFieldGroupClassName}>
                  <Label htmlFor="disp-res-ln" className="text-xs text-muted-foreground">
                    Nachname
                  </Label>
                  <Input
                    id="disp-res-ln"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className={drawerTwoColClass}>
                <div className={drawerFormFieldGroupClassName}>
                  <Label className="text-xs text-muted-foreground">Telefon</Label>
                  <GuestPhoneField
                    countryId="disp-res-phone-country"
                    localId="disp-res-phone-local"
                    countryIso={phoneCountryIso}
                    onCountryChange={setPhoneCountryIso}
                    localValue={phoneLocal}
                    onLocalChange={setPhoneLocal}
                    countries={countries}
                    localInputMode={displayTouchPhoneLocalInputMode}
                    tall
                  />
                </div>
                <div className={drawerFormFieldGroupClassName}>
                  <Label htmlFor="disp-res-email" className="text-xs text-muted-foreground">
                    E-Mail
                  </Label>
                  <Input
                    id="disp-res-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className={drawerTwoColClass}>
                <div className={drawerFormFieldGroupClassName}>
                  <Label htmlFor="disp-res-dwell" className="text-xs text-muted-foreground">
                    Verweildauer (Min.)
                  </Label>
                  <Input
                    id="disp-res-dwell"
                    {...displayTouchNumericInputProps}
                    value={dwellDraft}
                    onChange={(e) =>
                      setDwellDraft(digitsOnlyInput(e.target.value, 4))
                    }
                    className={cn(fieldClass, "tabular-nums")}
                  />
                </div>
                <div className={drawerFormFieldGroupClassName}>
                  <Label htmlFor="disp-res-table" className="text-xs text-muted-foreground">
                    Tisch
                  </Label>
                  <Select
                    value={tableId}
                    items={tableItems}
                    disabled={!tableAssignmentAllowed}
                    onValueChange={(v) => {
                      if (typeof v === "string") setTableId(v);
                    }}
                  >
                    <SelectTrigger
                      id="disp-res-table"
                      disabled={!tableAssignmentAllowed}
                      className={appSelectTriggerAccentCn(
                        "h-12 min-h-12 w-full rounded-xl px-3 text-left text-base font-normal",
                        !tableAssignmentAllowed && "cursor-not-allowed opacity-50",
                        selectValueNoShrink,
                      )}
                    >
                      <SelectValue placeholder="Tisch">{tableSelectedLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Kein Tisch</SelectItem>
                      {tables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {formatDiningTableSelectLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!tableAssignmentAllowed ? (
                    <p className="text-[11px] text-muted-foreground">
                      Tischzuordnung nur bei Status „Bestätigt“ oder „Am Tisch“.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className={drawerFormFieldGroupClassName}>
                <Label htmlFor="disp-res-internal-note" className="text-xs text-muted-foreground">
                  Interne Notiz
                </Label>
                <Textarea
                  id="disp-res-internal-note"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  rows={3}
                  placeholder="Wünsche, Allergien, Anlass … (nur für das Team)"
                  className="min-h-[4.5rem] resize-y rounded-xl"
                />
              </div>
              </div>

              <DrawerFormSection title="Benachrichtigungen & AGB">
                <div
                  className={cn(
                    displayDrawerFormSwitchRowClassName,
                    !hasEmail && "opacity-50",
                  )}
                >
                  <span
                    id="disp-res-notify-email"
                    className="flex min-w-0 items-center gap-2.5 text-sm leading-snug"
                  >
                    <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    E-Mail-Benachrichtigung
                  </span>
                  <Switch
                    checked={notifyEmail}
                    disabled={!hasEmail}
                    onCheckedChange={(v) => setNotifyEmail(v === true)}
                    size="sm"
                    aria-labelledby="disp-res-notify-email"
                  />
                </div>
                <div
                  className={cn(
                    displayDrawerFormSwitchRowClassName,
                    !hasPhone && "opacity-50",
                  )}
                >
                  <span
                    id="disp-res-notify-whatsapp"
                    className="flex min-w-0 items-center gap-2.5 text-sm leading-snug"
                  >
                    <WhatsAppGlyph className="text-[#25D366]" />
                    WhatsApp-Benachrichtigung
                  </span>
                  <Switch
                    checked={notifyWhatsapp}
                    disabled={!hasPhone}
                    onCheckedChange={(v) => setNotifyWhatsapp(v === true)}
                    size="sm"
                    aria-labelledby="disp-res-notify-whatsapp"
                  />
                </div>
                <div className={displayDrawerFormSwitchRowClassName}>
                  <span
                    id="disp-res-terms"
                    className="flex min-w-0 items-center gap-2.5 text-sm leading-snug"
                  >
                    <TermsGlyph className="text-muted-foreground" />
                    AGB akzeptiert
                  </span>
                  <Switch
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(v === true)}
                    size="sm"
                    aria-labelledby="disp-res-terms"
                  />
                </div>
              </DrawerFormSection>
            </div>

            <div className="flex shrink-0 gap-2 border-t border-border/50 px-6 py-3">
              <Button
                type="button"
                variant="outline"
                className={displayDrawerFormFooterButtonClassName}
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                className={displayDrawerFormFooterButtonClassName}
                disabled={saving}
                onClick={() => void submit()}
              >
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Speichern
              </Button>
            </div>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
