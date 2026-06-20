"use client";

import { useEffect, useMemo, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {drawerFormFieldClassName,  drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
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
import { DatePickerField } from "@/components/ui/date-picker";
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
  hhmmToMinutes,
  minutesToHHmm,
} from "@/lib/reservations/day-opening-slots";
import {
  normalizeBookingTimeStepMinutes,
  snapMinutesToBookingStep,
  type BookingTimeStepMinutes,
} from "@/lib/reservations/booking-time-step";
import {
  datetimeLocalValueToIso,
  localDayToYmd,
  ymdAndHmToDatetimeLocal,
} from "@/lib/reservations/datetime-local";
import { reservationAllowsTableAssignment } from "@/lib/reservations/reservation-table-assignment";
import {
  formatDiningTableSelectLabel,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type Status = { id: string; code: string; name: string; color_hex: string };

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

function defaultTimeHm(step: BookingTimeStepMinutes): string {
  const d = new Date();
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const snapped = snapMinutesToBookingStep(nowMin, step);
  return minutesToHHmm(snapped);
}

export function DisplayReservationDrawer({
  open,
  onOpenChange,
  statuses,
  tables,
  defaultDwellMinutes,
  bookingTimeStepMinutes,
  nextReservationNumber,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: Status[];
  tables: DiningTableRow[];
  defaultDwellMinutes: number;
  bookingTimeStepMinutes: number;
  nextReservationNumber: number | null;
  onCreated: () => void;
}) {
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
  const [guestMessage, setGuestMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const coRes = await fetchCountries();
      if (coRes.data.length > 0) setCountries(coRes.data);
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const confirmed = statuses.find((s) => s.code === "confirmed");
    setFirstName("");
    setLastName("");
    setPartySize("2");
    setDateYmd(localDayToYmd(new Date()));
    setTimeHm(defaultTimeHm(step));
    setStatusId(confirmed?.id ?? statuses[0]?.id ?? "");
    setNotifyEmail(true);
    setNotifyWhatsapp(false);
    setTermsAccepted(true);
    setDwellDraft(String(defaultDwellMinutes));
    setTableId("__none__");
    setPhoneLocal("");
    setEmail("");
    setGuestMessage("");
  }, [open, statuses, defaultDwellMinutes, step]);

  const statusItems = useMemo(
    () => statuses.map((s) => ({ value: s.id, label: s.name })),
    [statuses],
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

  const fieldClass = drawerFormFieldClassName;
  const drawerTwoColClass = "grid gap-3 sm:grid-cols-2";

  const snapTimeField = (hm: string) => {
    const snapped = minutesToHHmm(snapMinutesToBookingStep(hhmmToMinutes(hm), step));
    setTimeHm(snapped);
    return snapped;
  };

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
    const snappedTime = snapTimeField(timeHm);
    const startsLocalCombined = ymdAndHmToDatetimeLocal(dateYmd, snappedTime);
    const startsIso = datetimeLocalValueToIso(startsLocalCombined);
    const dwellTrim = dwellDraft.trim();
    let minutesForEnd = defaultDwellMinutes;
    if (dwellTrim !== "") {
      const n = Number.parseInt(dwellTrim, 10);
      if (!Number.isFinite(n) || n < 15 || n > 1440) {
        toast.error("Verweildauer: 15–1440 Minuten.");
        return;
      }
      minutesForEnd = n;
    }
    const endsIso = new Date(
      new Date(startsIso).getTime() + minutesForEnd * 60 * 1000,
    ).toISOString();

    setSaving(true);
    try {
      const res = await fetch("/api/display/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          guest_first_name: firstName.trim() || "Gast",
          guest_last_name: lastName.trim(),
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
          guest_message: guestMessage.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        reservation_number?: number;
        guest_pin?: string;
      };
      if (!res.ok) {
        toast.error(
          data.error === "session_expired"
            ? "Sitzung abgelaufen — bitte erneut anmelden."
            : (data.error ?? "Speichern fehlgeschlagen."),
        );
        return;
      }
      toast.success(
        data.reservation_number
          ? `Reservierung #${data.reservation_number} angelegt.${data.guest_pin ? ` Gast-PIN: ${data.guest_pin}` : ""}`
          : "Reservierung angelegt.",
      );
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("form")}>
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
            <div className={drawerScrollAreaClassName(6)}>
              <div className={drawerTwoColClass}>
                <div className="min-w-0 space-y-1.5">
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
                        "h-11 min-h-11 w-full rounded-xl px-3 text-left text-sm font-normal",
                        selectValueNoShrink,
                      )}
                    >
                      <SelectValue placeholder="Status" />
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
                <div className="space-y-1.5">
                  <Label htmlFor="disp-res-ps" className="text-xs text-muted-foreground">
                    Personen
                  </Label>
                  <Input
                    id="disp-res-ps"
                    type="number"
                    min={1}
                    max={50}
                    value={partySize}
                    onChange={(e) => setPartySize(e.target.value)}
                    className={cn(fieldClass, "tabular-nums")}
                  />
                </div>
              </div>

              <div className={drawerTwoColClass}>
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label htmlFor="disp-res-time" className="text-xs text-muted-foreground">
                    Uhrzeit
                  </Label>
                  <Input
                    id="disp-res-time"
                    type="time"
                    step={step === 1 ? 60 : step * 60}
                    value={timeHm}
                    onChange={(e) => setTimeHm(e.target.value)}
                    onBlur={() => snapTimeField(timeHm)}
                    className={cn(fieldClass, "tabular-nums")}
                  />
                </div>
              </div>

              <div className={drawerTwoColClass}>
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Telefon</Label>
                  <GuestPhoneField
                    countryId="disp-res-phone-country"
                    localId="disp-res-phone-local"
                    countryIso={phoneCountryIso}
                    onCountryChange={setPhoneCountryIso}
                    localValue={phoneLocal}
                    onLocalChange={setPhoneLocal}
                    countries={countries}
                  />
                </div>
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label htmlFor="disp-res-dwell" className="text-xs text-muted-foreground">
                    Verweildauer (Min.)
                  </Label>
                  <Input
                    id="disp-res-dwell"
                    type="number"
                    min={15}
                    max={1440}
                    value={dwellDraft}
                    onChange={(e) => setDwellDraft(e.target.value)}
                    className={cn(fieldClass, "tabular-nums")}
                  />
                </div>
                <div className="space-y-1.5">
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
                        "h-11 min-h-11 w-full rounded-xl px-3 text-left text-sm font-normal",
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

              <div className="space-y-1.5">
                <Label htmlFor="disp-res-guest-message" className="text-xs text-muted-foreground">
                  Nachricht an das Restaurant
                </Label>
                <Textarea
                  id="disp-res-guest-message"
                  value={guestMessage}
                  onChange={(e) => setGuestMessage(e.target.value)}
                  rows={3}
                  placeholder="Wünsche, Allergien, Anlass …"
                  className="min-h-[4.5rem] resize-y rounded-xl"
                />
              </div>

              <DrawerFormSection title="Benachrichtigungen & AGB">
                <div
                  className={cn(
                    "flex items-center justify-between gap-3",
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
                    "flex items-center justify-between gap-3",
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
                <div className="flex items-center justify-between gap-3">
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
                className="h-11 flex-1 rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-xl"
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
