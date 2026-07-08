"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {drawerFormFieldClassName,  drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { TermsGlyph } from "@/components/icons/terms-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField, formScheduleTimeInputFullWidthClassName } from "@/components/ui/date-picker";
import { useDisplayRestaurantTimezone } from "@/components/display/display-restaurant-timezone-provider";
import { GuestPhoneField } from "@/components/phone/guest-phone-field";
import { ReservationAccessMeta } from "@/components/reservations/reservation-access-meta";
import { ReservationStatusLabel } from "@/components/reservations/reservation-status-label";
import {
  COUNTRIES_REFERENCE_FALLBACK,
  type CountryReference,
} from "@/lib/constants/countries";
import type {
  DisplayReservationDetail,
  DisplayReservationRow,
} from "@/lib/display/display-reservations-server";
import { dispatchReservationOpenResolvedLivePatch } from "@/lib/reservations/reservation-open-status";
import { parseGuestPhone, formatGuestPhone } from "@/lib/phone/guest-phone";
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
  restaurantIsoToYmdHm,
  ymdHmToRestaurantIso,
} from "@/lib/restaurant/restaurant-timezone";
import { reservationAllowsTableAssignment } from "@/lib/reservations/reservation-table-assignment";
import {
  checkTableAssignmentForSave,
  type TableAssignmentCheck,
} from "@/lib/reservations/reservation-table-conflicts";
import {
  formatDiningTableSelectLabel,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type Status = { id: string; code: string; name: string; color_hex: string };

type BuiltPayload = {
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status_id: string;
  dining_table_id: string | null;
  dwell_minutes: number | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
};

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

const DISPLAY_SESSION_ERRORS: Record<string, string> = {
  session_expired: "Sitzung abgelaufen — bitte erneut anmelden.",
  session_locked: "Bitte mit PIN anmelden.",
  module_forbidden: "Keine Berechtigung für Reservierungen.",
  not_found: "Reservierung nicht gefunden.",
  table_requires_confirmed:
    "Tischzuordnung nur bei Status „Bestätigt“ oder „Am Tisch“.",
};

export function DisplayReservationEditDrawer({
  open,
  onOpenChange,
  reservationId,
  statuses,
  tables,
  reservations,
  defaultDwellMinutes,
  bookingTimeStepMinutes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string | null;
  statuses: Status[];
  tables: DiningTableRow[];
  reservations: ReservationListRow[];
  defaultDwellMinutes: number;
  bookingTimeStepMinutes: number;
  onSaved: (reservation?: DisplayReservationRow | null) => void;
}) {
  const timeZone = useDisplayRestaurantTimezone();
  const step = normalizeBookingTimeStepMinutes(
    bookingTimeStepMinutes,
  ) as BookingTimeStepMinutes;
  const [countries, setCountries] = useState<CountryReference[]>(
    COUNTRIES_REFERENCE_FALLBACK,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<DisplayReservationDetail | null>(null);
  const allowDrawerCloseRef = useRef(false);
  const [tableSharePending, setTableSharePending] = useState<{
    payload: BuiltPayload;
    detail: Extract<TableAssignmentCheck, { kind: "confirm_share" }>;
  } | null>(null);

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
  const initialStatusCodeRef = useRef("");
  const restaurantIdRef = useRef("");

  const populateFromDetail = useCallback(
    (d: DisplayReservationDetail) => {
      restaurantIdRef.current = d.restaurant_id;
      initialStatusCodeRef.current = d.status?.code ?? "";
      setFirstName(d.guest_first_name);
      setLastName(d.guest_last_name);
      const parsed = parseGuestPhone(
        d.guest_phone,
        COUNTRIES_REFERENCE_FALLBACK,
        "DE",
      );
      setPhoneCountryIso(parsed.iso2);
      setPhoneLocal(parsed.local);
      setEmail(d.guest_email ?? "");
      setPartySize(String(d.party_size));
      const { ymd, hm } = restaurantIsoToYmdHm(d.starts_at, timeZone);
      setDateYmd(ymd);
      setTimeHm(hm);
      setStatusId(d.status?.id ?? "");
      setNotifyEmail(d.notify_email);
      setNotifyWhatsapp(d.notify_whatsapp);
      setTermsAccepted(d.terms_accepted);
      setDwellDraft(
        d.dwell_minutes != null
          ? String(d.dwell_minutes)
          : String(defaultDwellMinutes),
      );
      setTableId(d.dining_table_id ?? "__none__");
    },
    [defaultDwellMinutes, timeZone],
  );

  useEffect(() => {
    if (!open || !reservationId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/display/reservations/${encodeURIComponent(reservationId)}`,
          { cache: "no-store", credentials: "include" },
        );
        const data = (await res.json()) as DisplayReservationDetail & {
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          toast.error(
            DISPLAY_SESSION_ERRORS[data.error ?? ""] ??
              "Reservierung konnte nicht geladen werden.",
          );
          onOpenChange(false);
          return;
        }
        setDetail(data);
        populateFromDetail(data);
      } catch {
        if (!cancelled) {
          toast.error("Reservierung konnte nicht geladen werden.");
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reservationId, onOpenChange, populateFromDetail]);

  const handleDrawerOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        if (tableSharePending !== null && !allowDrawerCloseRef.current) {
          return;
        }
        allowDrawerCloseRef.current = false;
      } else {
        allowDrawerCloseRef.current = false;
      }
      onOpenChange(next);
    },
    [tableSharePending, onOpenChange],
  );

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

  const buildPayload = (): BuiltPayload | null => {
    const ps = Number.parseInt(partySize, 10);
    if (!Number.isFinite(ps) || ps < 1 || ps > 50) {
      toast.error("Personenzahl zwischen 1 und 50.");
      return null;
    }
    if (!dateYmd.trim()) {
      toast.error("Bitte ein Datum wählen.");
      return null;
    }
    if (!statusId) {
      toast.error("Bitte einen Status wählen.");
      return null;
    }
    const snappedTime = snapTimeField(timeHm);
    let startsIso: string;
    try {
      startsIso = ymdHmToRestaurantIso(dateYmd, snappedTime, timeZone);
    } catch {
      toast.error("Ungültiges Datum oder Uhrzeit.");
      return null;
    }
    const dwellTrim = dwellDraft.trim();
    let minutesForEnd = defaultDwellMinutes;
    if (dwellTrim !== "") {
      const n = Number.parseInt(dwellTrim, 10);
      if (!Number.isFinite(n) || n < 15 || n > 1440) {
        toast.error("Verweildauer: 15–1440 Minuten.");
        return null;
      }
      minutesForEnd = n;
    }
    const endsIso = new Date(
      new Date(startsIso).getTime() + minutesForEnd * 60 * 1000,
    ).toISOString();

    return {
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
    };
  };

  const executeSave = async (payload: BuiltPayload) => {
    if (!reservationId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/display/reservations/${encodeURIComponent(reservationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        reservation?: DisplayReservationRow | null;
      };
      if (!res.ok) {
        toast.error(
          DISPLAY_SESSION_ERRORS[data.error ?? ""] ??
            "Speichern fehlgeschlagen.",
        );
        return;
      }
      toast.success("Reservierung gespeichert.");
      const newStatusCode =
        statuses.find((s) => s.id === payload.status_id)?.code ?? "";
      if (reservationId && restaurantIdRef.current) {
        dispatchReservationOpenResolvedLivePatch({
          restaurantId: restaurantIdRef.current,
          reservationId,
          previousStatusCode: initialStatusCodeRef.current,
          nextStatusCode: newStatusCode,
        });
        initialStatusCodeRef.current = newStatusCode;
      }
      allowDrawerCloseRef.current = true;
      setTableSharePending(null);
      onOpenChange(false);
      onSaved(data.reservation ?? null);
    } catch {
      toast.error("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const payload = buildPayload();
    if (!payload) return;

    const check = checkTableAssignmentForSave({
      tableId: payload.dining_table_id,
      partySize: payload.party_size,
      startsAt: payload.starts_at,
      endsAt: payload.ends_at,
      excludeReservationId: reservationId,
      tables,
      knownReservations: reservations,
    });

    if (check.kind === "capacity_exceeded") {
      toast.error(check.message);
      return;
    }
    if (check.kind === "confirm_share") {
      setTableSharePending({ payload, detail: check });
      return;
    }

    void executeSave(payload);
  };

  const notesDisplay =
    detail?.notes && !detail.notes.startsWith("display-demo:")
      ? detail.notes
      : null;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={handleDrawerOpenChange}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("form")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              Reservierung bearbeiten
            </DrawerTitle>
            {detail && !loading ? (
              <DrawerDescription className="text-base leading-relaxed">
                <ReservationAccessMeta
                  reservationNumber={detail.reservation_number}
                  guestPin={detail.guest_pin}
                />
              </DrawerDescription>
            ) : loading ? (
              <Skeleton className="mt-2 h-5 w-48 rounded-md" />
            ) : null}
          </DrawerHeader>

          {open ? (
            <>
              <div className={drawerScrollAreaClassName(6)}>
                {loading ? (
                  <div className="space-y-3" aria-busy>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <>
                    <DrawerFormSection title="Termin & Status">
                    <div className={drawerTwoColClass}>
                      <div className="min-w-0 space-y-1.5">
                        <Label
                          htmlFor="disp-edit-status"
                          className="text-xs text-muted-foreground"
                        >
                          Status
                        </Label>
                        <Select
                          value={statusId}
                          items={statusItems}
                          onValueChange={(v) => {
                            if (typeof v !== "string") return;
                            setStatusId(v);
                            const next = statuses.find((s) => s.id === v);
                            if (
                              next?.code !== "confirmed" &&
                              next?.code !== "seated"
                            ) {
                              setTableId("__none__");
                            }
                          }}
                        >
                          <SelectTrigger
                            id="disp-edit-status"
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
                        <Label
                          htmlFor="disp-edit-ps"
                          className="text-xs text-muted-foreground"
                        >
                          Personen
                        </Label>
                        <Input
                          id="disp-edit-ps"
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
                        <Label
                          htmlFor="disp-edit-time"
                          className="text-xs text-muted-foreground"
                        >
                          Uhrzeit
                        </Label>
                        <input
                          id="disp-edit-time"
                          type="time"
                          value={timeHm}
                          onChange={(e) => setTimeHm(e.target.value)}
                          className={formScheduleTimeInputFullWidthClassName}
                        />
                      </div>
                    </div>
                    </DrawerFormSection>

                    <DrawerFormSection title="Gast">
                    <div className={drawerTwoColClass}>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="disp-edit-fn"
                          className="text-xs text-muted-foreground"
                        >
                          Vorname
                        </Label>
                        <Input
                          id="disp-edit-fn"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="disp-edit-ln"
                          className="text-xs text-muted-foreground"
                        >
                          Nachname
                        </Label>
                        <Input
                          id="disp-edit-ln"
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
                          countryId="disp-edit-phone-country"
                          localId="disp-edit-phone-local"
                          countryIso={phoneCountryIso}
                          onCountryChange={setPhoneCountryIso}
                          localValue={phoneLocal}
                          onLocalChange={setPhoneLocal}
                          countries={countries}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="disp-edit-email"
                          className="text-xs text-muted-foreground"
                        >
                          E-Mail
                        </Label>
                        <Input
                          id="disp-edit-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                    </div>

                    {notesDisplay ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Gastnotiz
                        </Label>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {notesDisplay}
                        </p>
                      </div>
                    ) : null}
                    </DrawerFormSection>

                    <DrawerFormSection title="Tisch & Verweildauer">
                    <div className={drawerTwoColClass}>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="disp-edit-dwell"
                          className="text-xs text-muted-foreground"
                        >
                          Verweildauer (Min.)
                        </Label>
                        <Input
                          id="disp-edit-dwell"
                          type="number"
                          min={15}
                          max={1440}
                          value={dwellDraft}
                          onChange={(e) => setDwellDraft(e.target.value)}
                          className={cn(fieldClass, "tabular-nums")}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="disp-edit-table"
                          className="text-xs text-muted-foreground"
                        >
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
                            id="disp-edit-table"
                            disabled={!tableAssignmentAllowed}
                            className={appSelectTriggerAccentCn(
                              "h-11 min-h-11 w-full rounded-xl px-3 text-left text-sm font-normal",
                              !tableAssignmentAllowed && "cursor-not-allowed opacity-50",
                              selectValueNoShrink,
                            )}
                          >
                            <SelectValue placeholder="Tisch">
                              {tableSelectedLabel}
                            </SelectValue>
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
                    </DrawerFormSection>

                    <DrawerFormSection title="Benachrichtigungen & AGB">
                      <div
                        className={cn(
                          "flex items-center justify-between gap-3",
                          !hasEmail && "opacity-50",
                        )}
                      >
                        <span
                          id="disp-edit-notify-email"
                          className="flex min-w-0 items-center gap-2.5 text-sm leading-snug"
                        >
                          <Mail
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          E-Mail-Benachrichtigung
                        </span>
                        <Switch
                          checked={notifyEmail}
                          disabled={!hasEmail}
                          onCheckedChange={(v) => setNotifyEmail(v === true)}
                          size="sm"
                          aria-labelledby="disp-edit-notify-email"
                        />
                      </div>
                      <div
                        className={cn(
                          "flex items-center justify-between gap-3",
                          !hasPhone && "opacity-50",
                        )}
                      >
                        <span
                          id="disp-edit-notify-whatsapp"
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
                          aria-labelledby="disp-edit-notify-whatsapp"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span
                          id="disp-edit-terms"
                          className="flex min-w-0 items-center gap-2.5 text-sm leading-snug"
                        >
                          <TermsGlyph className="text-muted-foreground" />
                          AGB akzeptiert
                        </span>
                        <Switch
                          checked={termsAccepted}
                          onCheckedChange={(v) => setTermsAccepted(v === true)}
                          size="sm"
                          aria-labelledby="disp-edit-terms"
                        />
                      </div>
                    </DrawerFormSection>
                  </>
                )}
              </div>

              <div className="flex shrink-0 gap-2 border-t border-border/50 px-6 py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 rounded-xl"
                  disabled={saving}
                  onClick={() => onOpenChange(false)}
                >
                  Abbrechen
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl"
                  disabled={saving || loading || !detail}
                  onClick={() => void handleSave()}
                >
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Speichern
                </Button>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={tableSharePending !== null}
        onOpenChange={(o) => {
          if (!o) setTableSharePending(null);
        }}
        title="Tisch gemeinsam nutzen?"
        destructive={false}
        confirmLabel="Ja, zusammenlegen"
        cancelLabel="Nein, anderen Tisch"
        confirmDisabled={saving}
        description={
          tableSharePending ? (
            <>
              Am Tisch „{tableSharePending.detail.tableLabel}“ sind für diesen
              Zeitraum bereits{" "}
              <span className="font-medium text-foreground">
                {tableSharePending.detail.seatUsed} Person
                {tableSharePending.detail.seatUsed === 1 ? "" : "en"}
              </span>{" "}
              aus {tableSharePending.detail.otherCount} Reservierung
              {tableSharePending.detail.otherCount === 1 ? "" : "en"} zugewiesen
              (Kapazität {tableSharePending.detail.capacity}, noch{" "}
              {tableSharePending.detail.remaining} frei). Sie planen{" "}
              {tableSharePending.detail.partySize} Person
              {tableSharePending.detail.partySize === 1 ? "" : "en"}.
              <br />
              <br />
              Sollen die Reservierungen wirklich gemeinsam an diesem Tisch
              platziert werden?
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!tableSharePending) return;
          await executeSave(tableSharePending.payload);
        }}
      />
    </>
  );
}
