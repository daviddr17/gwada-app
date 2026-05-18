"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DatePickerField,
  formScheduleTimeInputClassName,
} from "@/components/ui/date-picker";
import {
  datetimeLocalValueToIso,
  datetimeLocalValueToYmdHm,
  isoToDatetimeLocalValue,
  localDayToYmd,
  ymdAndHmToDatetimeLocal,
} from "@/lib/reservations/datetime-local";
import { formatDayHeadingDe } from "@/lib/reservations/month-range";
import {
  formatDiningTableLabel,
  fetchDiningTables,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import { fetchReservationSettings } from "@/lib/supabase/reservation-settings-db";
import {
  deleteReservation,
  fetchReservationStatuses,
  insertReservation,
  updateReservation,
  type ReservationListRow,
  type ReservationStatusJoin,
} from "@/lib/supabase/reservations-db";
import {
  checkTableAssignmentForSave,
  type TableAssignmentCheck,
} from "@/lib/reservations/reservation-table-conflicts";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

export type ReservationEditDrawerCreateContext = {
  restaurantId: string;
  day: Date;
  /** Lokale Uhrzeit HH:mm für neue Reservierung (z. B. aus Tagesübersicht / Tischplan). */
  initialTimeHm?: string;
  initialDiningTableId?: string | null;
};

type ReservationEditDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: ReservationListRow | null;
  createFor: ReservationEditDrawerCreateContext | null;
  /** Geladene Reservierungen (z. B. Monatsliste) für Tisch-Kapazität / Überlappung. */
  overlapReservations?: ReservationListRow[];
  onSaved: () => void;
};

type BuiltReservationPayload = {
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

export function ReservationEditDrawer({
  open,
  onOpenChange,
  reservation,
  createFor,
  overlapReservations = [],
  onSaved,
}: ReservationEditDrawerProps) {
  const isEdit = Boolean(reservation);
  const isCreate = Boolean(createFor) && !reservation;

  const [statuses, setStatuses] = useState<ReservationStatusJoin[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [tableSharePending, setTableSharePending] = useState<{
    payload: BuiltReservationPayload;
    detail: Extract<TableAssignmentCheck, { kind: "confirm_share" }>;
  } | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [dateYmd, setDateYmd] = useState("");
  const [timeHm, setTimeHm] = useState("19:00");
  const [statusId, setStatusId] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [tables, setTables] = useState<DiningTableRow[]>([]);
  const [defaultDwellMinutes, setDefaultDwellMinutes] = useState(120);
  const [dwellDraft, setDwellDraft] = useState("");
  const [tableId, setTableId] = useState<string>("__none__");

  /** Wenn ein Modal (Löschen / Tisch teilen) offen ist, unterdrückt Vaul fälschlich `onOpenChange(false)` — außer nach explizitem Schließen. */
  const allowDrawerCloseRef = useRef(false);

  useEffect(() => {
    if (!open) {
      allowDrawerCloseRef.current = false;
      setConfirmDeleteOpen(false);
      setTableSharePending(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data, error } = await fetchReservationStatuses();
      if (error) {
        toast.error(error.message);
        return;
      }
      setStatuses(data);
    })();
  }, [open]);

  const restaurantIdForFetch =
    reservation?.restaurant_id ?? createFor?.restaurantId ?? null;

  const handleDrawerOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        if (
          (confirmDeleteOpen || tableSharePending !== null) &&
          !allowDrawerCloseRef.current
        ) {
          return;
        }
        allowDrawerCloseRef.current = false;
      } else {
        allowDrawerCloseRef.current = false;
      }
      onOpenChange(next);
    },
    [confirmDeleteOpen, tableSharePending, onOpenChange],
  );

  useEffect(() => {
    if (!open || !restaurantIdForFetch) return;
    void (async () => {
      const [{ data: tData, error: tErr }, { data: sData }] = await Promise.all([
        fetchDiningTables(restaurantIdForFetch),
        fetchReservationSettings(restaurantIdForFetch),
      ]);
      if (tErr) toast.error(tErr.message);
      setTables(tData);
      setDefaultDwellMinutes(sData?.default_dwell_minutes ?? 120);
    })();
  }, [open, restaurantIdForFetch]);

  useEffect(() => {
    if (!open) return;
    if (reservation) {
      setFirstName(reservation.guest_first_name);
      setLastName(reservation.guest_last_name);
      setPhone(reservation.guest_phone ?? "");
      setEmail(reservation.guest_email ?? "");
      setPartySize(String(reservation.party_size));
      const dl = isoToDatetimeLocalValue(reservation.starts_at);
      const { ymd, hm } = datetimeLocalValueToYmdHm(dl);
      setDateYmd(ymd);
      setTimeHm(hm);
      setStatusId(reservation.reservation_statuses?.id ?? "");
      setNotifyEmail(reservation.notify_email);
      setNotifyWhatsapp(reservation.notify_whatsapp);
      setTermsAccepted(reservation.terms_accepted);
      setDwellDraft(
        reservation.dwell_minutes != null ? String(reservation.dwell_minutes) : "",
      );
      setTableId(reservation.dining_table_id ?? "__none__");
      return;
    }
    if (createFor) {
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setPartySize("2");
      setDateYmd(localDayToYmd(createFor.day));
      const hm =
        createFor.initialTimeHm &&
        /^\d{1,2}:\d{2}$/.test(createFor.initialTimeHm.trim())
          ? (() => {
              const [hh, mm] = createFor.initialTimeHm.trim().split(":");
              return `${hh!.padStart(2, "0")}:${mm!.padStart(2, "0")}`;
            })()
          : "19:00";
      setTimeHm(hm);
      setStatusId("");
      setNotifyEmail(true);
      setNotifyWhatsapp(false);
      setTermsAccepted(true);
      setDwellDraft("");
      setTableId(
        createFor.initialDiningTableId &&
          createFor.initialDiningTableId.length > 0
          ? createFor.initialDiningTableId
          : "__none__",
      );
    }
  }, [reservation, createFor, open]);

  useEffect(() => {
    if (!open || reservation || !createFor || statuses.length === 0) return;
    setStatusId((cur) => {
      if (cur) return cur;
      return (
        statuses.find((s) => s.code === "confirmed")?.id ??
        statuses.find((s) => s.code === "pending")?.id ??
        statuses[0]?.id ??
        ""
      );
    });
  }, [open, reservation, createFor, statuses]);

  const statusItems = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.id, s.name])),
    [statuses],
  );

  const tableItems = useMemo(() => {
    const m: Record<string, string> = { __none__: "Kein Tisch" };
    for (const t of tables) {
      m[t.id] = formatDiningTableLabel(t);
    }
    return m;
  }, [tables]);

  const buildPayload = (): BuiltReservationPayload | null => {
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
    const startsLocalCombined = ymdAndHmToDatetimeLocal(dateYmd, timeHm);
    const startsIso = datetimeLocalValueToIso(startsLocalCombined);
    const dwellTrim = dwellDraft.trim();
    let dwellStored: number | null = null;
    let minutesForEnd = defaultDwellMinutes;
    if (dwellTrim !== "") {
      const n = Number.parseInt(dwellTrim, 10);
      if (!Number.isFinite(n) || n < 15 || n > 1440) {
        toast.error("Verweildauer leer oder 15–1440 Minuten.");
        return null;
      }
      dwellStored = n;
      minutesForEnd = n;
    }
    const endsIso = new Date(
      new Date(startsIso).getTime() + minutesForEnd * 60 * 1000,
    ).toISOString();

    return {
      guest_first_name: firstName.trim() || "Gast",
      guest_last_name: lastName.trim(),
      guest_phone: phone.trim() || null,
      guest_email: email.trim() || null,
      party_size: ps,
      starts_at: startsIso,
      ends_at: endsIso,
      status_id: statusId,
      dining_table_id: tableId === "__none__" ? null : tableId,
      dwell_minutes: dwellStored,
      notify_email: notifyEmail,
      notify_whatsapp: notifyWhatsapp,
      terms_accepted: termsAccepted,
    };
  };

  const executeSave = async (payload: BuiltReservationPayload) => {
    if (isEdit && reservation) {
      setSaving(true);
      const { error } = await updateReservation(reservation.id, payload);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Reservierung gespeichert.");
      allowDrawerCloseRef.current = true;
      setTableSharePending(null);
      onSaved();
      return;
    }

    if (isCreate && createFor) {
      setSaving(true);
      const { error } = await insertReservation({
        restaurant_id: createFor.restaurantId,
        ...payload,
      });
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Reservierung angelegt.");
      allowDrawerCloseRef.current = true;
      setTableSharePending(null);
      onSaved();
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
      excludeReservationId: reservation?.id ?? null,
      tables,
      knownReservations: overlapReservations,
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

  const handleDeleteReservation = async () => {
    if (!reservation) return;
    setSaving(true);
    const { error } = await deleteReservation({
      restaurantId: reservation.restaurant_id,
      id: reservation.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reservierung gelöscht.");
    allowDrawerCloseRef.current = true;
    setConfirmDeleteOpen(false);
    onSaved();
  };

  const fieldClass =
    "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

  const canSave = isEdit || isCreate;

  return (
    <>
    <Drawer
      open={open}
      onOpenChange={handleDrawerOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        showHandle
        className="mx-auto flex max-h-[min(92dvh,720px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-left">
              <DrawerTitle className="text-xl font-semibold tracking-tight">
                {isCreate ? "Neue Reservierung" : "Reservierung bearbeiten"}
              </DrawerTitle>
              <DrawerDescription className="text-base">
                {isEdit && reservation ? (
                  <>
                    Nr.{" "}
                    <span className="font-mono font-semibold text-foreground">
                      #{reservation.reservation_number}
                    </span>
                  </>
                ) : isCreate && createFor ? (
                  <>Datum: {formatDayHeadingDe(createFor.day)}</>
                ) : null}
              </DrawerDescription>
            </div>
            {isEdit && reservation ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Reservierung löschen"
                disabled={saving}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </DrawerHeader>

        {open ? (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="res-fn" className="text-xs text-muted-foreground">
                    Vorname
                  </Label>
                  <Input
                    id="res-fn"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-ln" className="text-xs text-muted-foreground">
                    Nachname
                  </Label>
                  <Input
                    id="res-ln"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="res-phone" className="text-xs text-muted-foreground">
                    Telefon
                  </Label>
                  <Input
                    id="res-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={fieldClass}
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-email" className="text-xs text-muted-foreground">
                    E-Mail
                  </Label>
                  <Input
                    id="res-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="res-ps" className="text-xs text-muted-foreground">
                    Personen
                  </Label>
                  <Input
                    id="res-ps"
                    type="number"
                    min={1}
                    max={50}
                    value={partySize}
                    onChange={(e) => setPartySize(e.target.value)}
                    className={cn(fieldClass, "tabular-nums")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-status" className="text-xs text-muted-foreground">
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
                      id="res-status"
                      size="sm"
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
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 sm:w-fit">
                <Label className="text-xs text-muted-foreground">Datum</Label>
                <Label
                  htmlFor="res-time"
                  className="text-xs text-muted-foreground"
                >
                  Uhrzeit
                </Label>
                <div className="min-w-0">
                  <DatePickerField
                    value={dateYmd || null}
                    onChange={(d) => {
                      if (d) setDateYmd(d);
                    }}
                    placeholder="Datum wählen"
                    className="w-full max-w-[min(100%,18rem)] sm:w-[240px]"
                  />
                </div>
                <Input
                  id="res-time"
                  type="time"
                  value={timeHm}
                  onChange={(e) => setTimeHm(e.target.value)}
                  className={formScheduleTimeInputClassName}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="res-dwell" className="text-xs text-muted-foreground">
                    Verweildauer (Min.)
                  </Label>
                  <Input
                    id="res-dwell"
                    type="number"
                    min={15}
                    max={1440}
                    placeholder={`Standard (${defaultDwellMinutes})`}
                    value={dwellDraft}
                    onChange={(e) => setDwellDraft(e.target.value)}
                    className={cn(fieldClass, "tabular-nums")}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leer = Standard aus Einstellungen ({defaultDwellMinutes} Min.).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-table" className="text-xs text-muted-foreground">
                    Tisch
                  </Label>
                  <Select
                    value={tableId}
                    items={tableItems}
                    onValueChange={(v) => {
                      if (typeof v === "string") setTableId(v);
                    }}
                  >
                    <SelectTrigger
                      id="res-table"
                      size="sm"
                      className={appSelectTriggerAccentCn(
                        "h-11 min-h-11 w-full rounded-xl px-3 text-left text-sm font-normal",
                        selectValueNoShrink,
                      )}
                    >
                      <SelectValue placeholder="Tisch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Kein Tisch</SelectItem>
                      {tables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {formatDiningTableLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Benachrichtigungen & AGB
                </p>
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={notifyEmail}
                    onCheckedChange={(v) => setNotifyEmail(v === true)}
                  />
                  <span className="text-sm">E-Mail-Benachrichtigung</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={notifyWhatsapp}
                    onCheckedChange={(v) => setNotifyWhatsapp(v === true)}
                  />
                  <span className="text-sm">WhatsApp-Benachrichtigung</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(v === true)}
                  />
                  <span className="text-sm">AGB akzeptiert</span>
                </label>
              </div>
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
                disabled={saving || !canSave}
                onClick={handleSave}
              >
                Speichern
              </Button>
            </div>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>

    <ConfirmDialog
      open={confirmDeleteOpen}
      onOpenChange={setConfirmDeleteOpen}
      title="Reservierung wirklich löschen?"
      description={
        reservation ? (
          <>
            Reservierung #{reservation.reservation_number} für{" "}
            <span className="font-medium text-foreground">
              {reservation.guest_first_name} {reservation.guest_last_name}
            </span>{" "}
            wird dauerhaft entfernt.
          </>
        ) : null
      }
      confirmLabel="Ja, löschen"
      confirmDisabled={saving}
      onConfirm={handleDeleteReservation}
    />

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
