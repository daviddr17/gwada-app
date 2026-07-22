"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawerScrollAreaClassName, drawerFormHeaderClassName, drawerFormFieldClassName } from "@/lib/ui/drawer-form-section";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import Link from "next/link";
import { toast } from "sonner";
import { Contact, Mail, Trash2 } from "lucide-react";
import { TermsGlyph } from "@/components/icons/terms-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  reservationNotifyRowLabelClassName,
  reservationNotifyRowMailIconClassName,
  reservationNotifyRowTermsIconClassName,
  reservationNotifyRowWhatsAppIconClassName,
} from "@/components/reservations/reservation-notify-toggle-styles";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Button } from "@/components/ui/button";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ReservationMessagesPanel } from "@/components/contacts/reservation-messages-panel";
import { ReservationAccessMeta } from "@/components/reservations/reservation-access-meta";
import {
  GUEST_NOTIFY_MESSAGE_MAX_CHARS,
  normalizeGuestNotifyMessage,
} from "@/lib/reservations/append-guest-notify-message";
import { reservationInternalNoteText } from "@/lib/reservations/reservation-internal-note";
import {
  isValidStaffPartySize,
  RESERVATION_PARTY_SIZE_MAX_STAFF,
} from "@/lib/reservations/reservation-party-size";
import {
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
  reservationGuestFirstNameForForm,
} from "@/lib/reservations/reservation-guest-name";
import { ReservationChangeRequestPanel } from "@/components/reservations/reservation-change-request-panel";
import { ReservationCreatedHint } from "@/components/reservations/reservation-created-hint";
import { ReservationProtocolSection } from "@/components/reservations/reservation-protocol-section";
import { ReservationStatusLabel } from "@/components/reservations/reservation-status-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker";
import { localDayToYmd } from "@/lib/reservations/datetime-local";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantIsoToYmdHm,
  ymdHmToRestaurantIso,
} from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantIanaTimezone } from "@/lib/supabase/restaurant-timezone-db";
import {
  COUNTRIES_REFERENCE_FALLBACK,
  resolveCountryIso2FromLabel,
  type CountryReference,
} from "@/lib/constants/countries";
import { fetchCountries } from "@/lib/supabase/countries-db";
import { formatGuestPhone, parseGuestPhone } from "@/lib/phone/guest-phone";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { useDrawerFormKeyboardAssist } from "@/lib/hooks/use-drawer-form-keyboard-assist";
import {
  formatDiningTableLabel,
  fetchDiningTables,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import {
  triggerReservationEmailDispatch,
  emailDispatchUserMessage,
} from "@/lib/reservations/trigger-email-dispatch";
import {
  triggerReservationWhatsappDispatch,
  whatsappDispatchUserMessage,
} from "@/lib/reservations/trigger-whatsapp-dispatch";
import { reservationStatusDispatchEvent } from "@/lib/reservations/reservation-status-dispatch-event";
import {
  reservationDateTimeChanged,
  shouldRescheduleTimedOutbox,
} from "@/lib/reservations/reservation-datetime-reschedule";
import {
  dispatchDashboardReservationCreateLivePatch,
  dispatchDashboardReservationUpdateLivePatch,
} from "@/lib/dashboard/dispatch-dashboard-reservation-save-live-client";
import { dispatchReservationOpenResolvedLivePatch } from "@/lib/reservations/reservation-open-status";
import { fetchReservationSettings } from "@/lib/supabase/reservation-settings-db";
import {
  deleteReservation,
  defaultStaffReservationStatusId,
  fetchNextReservationNumber,
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
import { reservationAllowsTableAssignment } from "@/lib/reservations/reservation-table-assignment";
import {
  logReservationCreateFromBrowser,
  logReservationDeleteFromBrowser,
  logReservationUpdateFromBrowser,
} from "@/lib/reservations/reservation-log-client";
import { GuestPhoneField } from "@/components/phone/guest-phone-field";
import { useIsTouchTablet } from "@/hooks/use-touch-tablet";
import {
  digitsOnlyInput,
  touchNumericInputProps,
  touchPhoneLocalInputMode,
} from "@/lib/ui/touch-numeric-input";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  contactDisplayName,
  fetchContactById,
  primaryEmail,
  primaryPhone,
} from "@/lib/supabase/contacts-db";
import {
  maybeShowReservationExistingContactLinkToast,
  resolveExistingContactBeforeReservationLink,
} from "@/lib/reservations/reservation-existing-contact-link-toast";
import { cn } from "@/lib/utils";

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

export type ReservationEditDrawerCreateContext = {
  restaurantId: string;
  day: Date;
  /** Lokale Uhrzeit HH:mm für neue Reservierung (z. B. aus Tagesübersicht / Tischplan). */
  initialTimeHm?: string;
  initialDiningTableId?: string | null;
  /** Kontakt-ID — Gastfelder vorausfüllen. */
  initialContactId?: string;
  /** Ohne Kontakt-ID: Gastfelder aus Chat / Inbox. */
  initialGuestFirstName?: string;
  initialGuestLastName?: string;
  initialGuestPhone?: string | null;
  initialGuestEmail?: string | null;
};

export type ReservationWhatsappDispatchedPayload = {
  messageBody: string;
  messageId?: string;
  wahaMessageId?: string | null;
  threadContactId?: string;
};

type ReservationEditDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: ReservationListRow | null;
  createFor: ReservationEditDrawerCreateContext | null;
  /** Geladene Reservierungen (z. B. Monatsliste) für Tisch-Kapazität / Überlappung. */
  overlapReservations?: ReservationListRow[];
  /** Über Chat-Vollbild-Overlay legen (z-210). */
  stackAboveInboxOverlay?: boolean;
  onSaved: () => void;
  /** Nach erfolgreichem WhatsApp-Statusversand (für Chat-Optimistic). */
  onWhatsappDispatched?: (payload: ReservationWhatsappDispatchedPayload) => void;
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
  notes: string | null;
};

export function ReservationEditDrawer({
  open,
  onOpenChange,
  reservation,
  createFor,
  overlapReservations = [],
  stackAboveInboxOverlay = false,
  onSaved,
  onWhatsappDispatched,
}: ReservationEditDrawerProps) {
  const isEdit = Boolean(reservation);
  const isCreate = Boolean(createFor) && !reservation;
  const { getProfileForRestaurantId } = useRestaurantProfile();
  const { isSuperadmin } = useIsSuperadmin();

  const [statuses, setStatuses] = useState<ReservationStatusJoin[]>([]);
  const [countries, setCountries] = useState<CountryReference[]>([]);
  const [nextReservationNumber, setNextReservationNumber] = useState<number | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [tableSharePending, setTableSharePending] = useState<{
    payload: BuiltReservationPayload;
    detail: Extract<TableAssignmentCheck, { kind: "confirm_share" }>;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { repositionInputs } = useDrawerFormKeyboardAssist({ open, scrollRef });
  const touchTablet = useIsTouchTablet();
  const touchNumericProps = touchNumericInputProps(touchTablet);
  const phoneLocalInputMode = touchPhoneLocalInputMode(touchTablet);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneCountryIso, setPhoneCountryIso] = useState("DE");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [dateYmd, setDateYmd] = useState("");
  const [timeHm, setTimeHm] = useState("19:00");
  const [statusId, setStatusId] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [tables, setTables] = useState<DiningTableRow[]>([]);
  const [defaultDwellMinutes, setDefaultDwellMinutes] = useState(120);
  const [dwellDraft, setDwellDraft] = useState("");
  const [tableId, setTableId] = useState<string>("__none__");
  const [internalNote, setInternalNote] = useState("");
  /** Wird der Status-Benachrichtigung (Vorlage) als „Nachricht:“ angehängt. */
  const [guestNotifyMessage, setGuestNotifyMessage] = useState("");
  const [protocolRefreshKey, setProtocolRefreshKey] = useState(0);
  const [restaurantTimeZone, setRestaurantTimeZone] = useState(
    DEFAULT_RESTAURANT_TIMEZONE,
  );

  /** Wenn ein Modal (Löschen / Tisch teilen) offen ist, unterdrückt Vaul fälschlich `onOpenChange(false)` — außer nach explizitem Schließen. */
  const allowDrawerCloseRef = useRef(false);
  const initialStatusCodeRef = useRef<string | null>(null);

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
      const [stRes, coRes] = await Promise.all([
        fetchReservationStatuses(),
        fetchCountries(),
      ]);
      if (stRes.error) toast.error(stRes.error.message);
      else setStatuses(stRes.data);
      if (coRes.error) toast.error(coRes.error.message);
      setCountries(coRes.data);
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !isCreate || !createFor?.restaurantId) {
      setNextReservationNumber(null);
      return;
    }
    void (async () => {
      const { data, error } = await fetchNextReservationNumber(
        createFor.restaurantId,
      );
      if (error) toast.error(error.message);
      setNextReservationNumber(data);
    })();
  }, [open, isCreate, createFor?.restaurantId]);

  const restaurantIdForFetch =
    reservation?.restaurant_id ?? createFor?.restaurantId ?? null;

  const countriesForPhone = useMemo(
    () => (countries.length > 0 ? countries : COUNTRIES_REFERENCE_FALLBACK),
    [countries],
  );

  const selectedStatus = useMemo(
    () => statuses.find((s) => s.id === statusId) ?? null,
    [statuses, statusId],
  );

  const tableAssignmentAllowed = useMemo(
    () => reservationAllowsTableAssignment(statusId, statuses),
    [statusId, statuses],
  );

  useEffect(() => {
    if (!tableAssignmentAllowed && tableId !== "__none__") {
      setTableId("__none__");
    }
  }, [tableAssignmentAllowed, tableId]);

  const hasEmail = email.trim().length > 0;

  const hasPhone = useMemo(
    () =>
      Boolean(
        formatGuestPhone(phoneCountryIso, phoneLocal, countriesForPhone)?.trim(),
      ),
    [phoneCountryIso, phoneLocal, countriesForPhone],
  );

  useEffect(() => {
    if (!hasEmail && notifyEmail) setNotifyEmail(false);
  }, [hasEmail, notifyEmail]);

  useEffect(() => {
    if (!hasPhone && notifyWhatsapp) setNotifyWhatsapp(false);
  }, [hasPhone, notifyWhatsapp]);

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
      const [{ data: tData, error: tErr }, { data: sData }, timeZone] =
        await Promise.all([
          fetchDiningTables(restaurantIdForFetch),
          fetchReservationSettings(restaurantIdForFetch),
          fetchRestaurantIanaTimezone(restaurantIdForFetch),
        ]);
      if (tErr) toast.error(tErr.message);
      setTables(tData);
      setDefaultDwellMinutes(sData?.default_dwell_minutes ?? 120);
      setRestaurantTimeZone(timeZone);
    })();
  }, [open, restaurantIdForFetch]);

  useEffect(() => {
    if (!open || reservation) return;
    if (!createFor) return;
    setDwellDraft(String(defaultDwellMinutes));
  }, [open, reservation?.id, createFor?.restaurantId, defaultDwellMinutes]);

  useEffect(() => {
    if (!open || !reservation || reservation.dwell_minutes != null) return;
    setDwellDraft(String(defaultDwellMinutes));
  }, [
    open,
    reservation?.id,
    reservation?.dwell_minutes,
    defaultDwellMinutes,
  ]);

  const reservationHydrateWasOpenRef = useRef(false);
  const reservationHydrateSeededKeyRef = useRef<string | null>(null);
  const countriesForPhoneRef = useRef(countriesForPhone);
  countriesForPhoneRef.current = countriesForPhone;

  useEffect(() => {
    if (!open) {
      reservationHydrateWasOpenRef.current = false;
      reservationHydrateSeededKeyRef.current = null;
      return;
    }
    const justOpened = !reservationHydrateWasOpenRef.current;
    reservationHydrateWasOpenRef.current = true;
    const seedKey = reservation?.id
      ?? `create:${createFor?.restaurantId ?? ""}:${createFor?.day ?? ""}:${createFor?.initialTimeHm ?? ""}:${createFor?.initialContactId ?? ""}`;
    if (!justOpened && reservationHydrateSeededKeyRef.current === seedKey) return;
    reservationHydrateSeededKeyRef.current = seedKey;

    const defaultIso = restaurantIdForFetch
      ? resolveCountryIso2FromLabel(
          getProfileForRestaurantId(restaurantIdForFetch).country,
          COUNTRIES_REFERENCE_FALLBACK,
        )
      : "DE";
    if (reservation) {
      setFirstName(reservationGuestFirstNameForForm(reservation.guest_first_name));
      setLastName(reservation.guest_last_name);
      const parsed = parseGuestPhone(
        reservation.guest_phone,
        COUNTRIES_REFERENCE_FALLBACK,
        defaultIso,
      );
      setPhoneCountryIso(parsed.iso2);
      setPhoneLocal(parsed.local);
      setEmail(reservation.guest_email ?? "");
      setPartySize(String(reservation.party_size));
      const { ymd, hm } = restaurantIsoToYmdHm(
        reservation.starts_at,
        restaurantTimeZone,
      );
      setDateYmd(ymd);
      setTimeHm(hm);
      setStatusId(reservation.reservation_statuses?.id ?? "");
      initialStatusCodeRef.current =
        reservation.reservation_statuses?.code ?? null;
      setNotifyEmail(reservation.notify_email);
      setNotifyWhatsapp(reservation.notify_whatsapp);
      setTermsAccepted(reservation.terms_accepted);
      setDwellDraft(
        reservation.dwell_minutes != null
          ? String(reservation.dwell_minutes)
          : String(defaultDwellMinutes),
      );
      setTableId(reservation.dining_table_id ?? "__none__");
      setInternalNote(reservationInternalNoteText(reservation.notes) ?? "");
      setGuestNotifyMessage("");
      return;
    }
    if (createFor) {
      setInternalNote("");
      setGuestNotifyMessage("");
      setFirstName("");
      setLastName("");
      setPhoneCountryIso(defaultIso);
      setPhoneLocal("");
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
      setNotifyEmail(false);
      setNotifyWhatsapp(false);
      setTermsAccepted(true);
      setDwellDraft(String(defaultDwellMinutes));
      setTableId(
        createFor.initialDiningTableId &&
          createFor.initialDiningTableId.length > 0
          ? createFor.initialDiningTableId
          : "__none__",
      );

      const contactId = createFor.initialContactId;
      if (contactId && createFor.restaurantId) {
        void (async () => {
          const { data, error } = await fetchContactById({
            restaurantId: createFor.restaurantId,
            contactId,
          });
          if (error || !data) return;
          setFirstName(reservationGuestFirstNameForForm(data.first_name));
          setLastName(data.last_name);
          const phone = primaryPhone(data);
          if (phone) {
            const parsed = parseGuestPhone(
              phone,
              countriesForPhoneRef.current,
              defaultIso,
            );
            setPhoneCountryIso(parsed.iso2);
            setPhoneLocal(parsed.local);
          }
          const mail = primaryEmail(data);
          if (mail) setEmail(mail);
        })();
      } else {
        if (createFor.initialGuestFirstName?.trim()) {
          setFirstName(
            reservationGuestFirstNameForForm(createFor.initialGuestFirstName),
          );
        }
        if (createFor.initialGuestLastName?.trim()) {
          setLastName(createFor.initialGuestLastName.trim().slice(0, 80));
        }
        const phone = createFor.initialGuestPhone?.trim();
        if (phone) {
          const parsed = parseGuestPhone(
            phone,
            countriesForPhoneRef.current,
            defaultIso,
          );
          setPhoneCountryIso(parsed.iso2);
          setPhoneLocal(parsed.local);
        }
        const mail = createFor.initialGuestEmail?.trim();
        if (mail?.includes("@")) setEmail(mail);
      }
    }
  }, [
    open,
    reservation?.id,
    createFor?.restaurantId,
    createFor?.day,
    createFor?.initialTimeHm,
    createFor?.initialDiningTableId,
    createFor?.initialContactId,
    createFor?.initialGuestFirstName,
    createFor?.initialGuestLastName,
    createFor?.initialGuestPhone,
    createFor?.initialGuestEmail,
    restaurantIdForFetch,
    restaurantTimeZone,
    getProfileForRestaurantId,
  ]);

  useEffect(() => {
    if (!open || reservation || !createFor || statuses.length === 0) return;
    setStatusId((cur) => {
      if (cur) return cur;
      return defaultStaffReservationStatusId(statuses);
    });
  }, [open, reservation, createFor, statuses]);

  useEffect(() => {
    if (!open || !reservation || statuses.length === 0) return;
    setStatusId((cur) => {
      if (cur) return cur;
      const code = reservation.reservation_statuses?.code;
      const fromCode = code
        ? statuses.find((s) => s.code === code)?.id
        : undefined;
      return fromCode ?? defaultStaffReservationStatusId(statuses);
    });
  }, [open, reservation, statuses]);

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
    if (!isValidStaffPartySize(ps)) {
      toast.error(
        `Personenzahl zwischen 1 und ${RESERVATION_PARTY_SIZE_MAX_STAFF}.`,
      );
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
    const startsIso = ymdHmToRestaurantIso(dateYmd, timeHm, restaurantTimeZone);
    if (!lastName.trim()) {
      toast.error("Bitte einen Nachnamen eingeben.");
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
    const dwellStored = minutesForEnd;
    const endsIso = new Date(
      new Date(startsIso).getTime() + minutesForEnd * 60 * 1000,
    ).toISOString();

    return {
      guest_first_name: normalizeReservationGuestFirstName(firstName),
      guest_last_name: normalizeReservationGuestLastName(lastName),
      guest_phone: formatGuestPhone(
        phoneCountryIso,
        phoneLocal,
        countriesForPhone,
      ),
      guest_email: email.trim() || null,
      party_size: ps,
      starts_at: startsIso,
      ends_at: endsIso,
      status_id: statusId,
      dining_table_id:
        tableAssignmentAllowed && tableId !== "__none__" ? tableId : null,
      dwell_minutes: dwellStored,
      notify_email: notifyEmail && hasEmail,
      notify_whatsapp: notifyWhatsapp && hasPhone,
      terms_accepted: termsAccepted,
      notes: internalNote.trim() || null,
    };
  };

  const restaurantDisplayName = restaurantIdForFetch
    ? getProfileForRestaurantId(restaurantIdForFetch).name.trim() || undefined
    : undefined;

  const executeSave = async (payload: BuiltReservationPayload) => {
    const newStatusCode =
      statuses.find((s) => s.id === payload.status_id)?.code ?? "";

    const restaurantId =
      reservation?.restaurant_id ?? createFor?.restaurantId ?? null;
    const existingContactBeforeSave =
      restaurantId != null
        ? await resolveExistingContactBeforeReservationLink({
            restaurantId,
            guestPhone: payload.guest_phone,
            guestEmail: payload.guest_email,
          })
        : null;

    if (isEdit && reservation) {
      setSaving(true);
      const { data: updated, error } = await updateReservation(
        reservation.id,
        payload,
      );
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      void logReservationUpdateFromBrowser({
        reservation,
        payload,
        statuses,
        tables,
      });
      setProtocolRefreshKey((k) => k + 1);
      toast.success("Reservierung gespeichert.");
      if (restaurantId) {
        void maybeShowReservationExistingContactLinkToast(
          {
            restaurantId,
            previousContactId: reservation.contact_id,
            savedContactId: updated?.contact_id ?? null,
          },
          existingContactBeforeSave,
        );
      }
      const dispatchEvent = reservationStatusDispatchEvent(
        initialStatusCodeRef.current,
        newStatusCode,
      );
      const notifyExtra = normalizeGuestNotifyMessage(guestNotifyMessage);
      const dispatchOpts = notifyExtra
        ? { guestNotifyMessage: notifyExtra }
        : undefined;
      if (dispatchEvent && payload.notify_whatsapp) {
        const wa = await triggerReservationWhatsappDispatch(
          reservation.id,
          dispatchEvent,
          dispatchOpts,
        );
        const msg = whatsappDispatchUserMessage(wa);
        if (msg) toast.warning(msg);
        if (wa?.ok && wa.messageBody?.trim()) {
          onWhatsappDispatched?.({
            messageBody: wa.messageBody,
            messageId: wa.messageId,
            wahaMessageId: wa.wahaMessageId,
            threadContactId: wa.threadContactId,
          });
        }
      }
      if (dispatchEvent && payload.notify_email) {
        void triggerReservationEmailDispatch(
          reservation.id,
          dispatchEvent,
          dispatchOpts,
        ).then((em) => {
          const msg = emailDispatchUserMessage(em, { isSuperadmin });
          if (msg) toast.warning(msg);
        });
      }
      if (dispatchEvent && notifyExtra) {
        setGuestNotifyMessage("");
      }
      const datetimeChanged = reservationDateTimeChanged(
        {
          starts_at: reservation.starts_at,
          ends_at: reservation.ends_at,
        },
        { starts_at: payload.starts_at, ends_at: payload.ends_at },
      );
      if (shouldRescheduleTimedOutbox(newStatusCode, datetimeChanged)) {
        if (payload.notify_whatsapp) {
          void triggerReservationWhatsappDispatch(reservation.id, "rescheduled");
        }
        if (payload.notify_email) {
          void triggerReservationEmailDispatch(reservation.id, "rescheduled");
        }
      }
      const previousStatusCode = initialStatusCodeRef.current ?? "";
      initialStatusCodeRef.current = newStatusCode;
      allowDrawerCloseRef.current = true;
      setTableSharePending(null);
      dispatchReservationOpenResolvedLivePatch({
        restaurantId: reservation.restaurant_id,
        reservationId: reservation.id,
        previousStatusCode,
        nextStatusCode: newStatusCode,
      });
      dispatchDashboardReservationUpdateLivePatch(reservation.restaurant_id);
      onSaved();
      return;
    }

    if (isCreate && createFor) {
      setSaving(true);
      const { data: created, error } = await insertReservation({
        restaurant_id: createFor.restaurantId,
        ...payload,
      });
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (created) {
        void logReservationCreateFromBrowser({
          restaurantId: createFor.restaurantId,
          reservationId: created.id,
          reservationNumber: created.reservation_number,
          guestFirstName: payload.guest_first_name,
          guestLastName: payload.guest_last_name,
          payload,
          statuses,
          tables,
        });
      }
      toast.success(
        created
          ? `Reservierung #${created.reservation_number} angelegt. Gast-PIN: ${created.guest_pin}`
          : "Reservierung angelegt.",
      );
      if (created && restaurantId) {
        void maybeShowReservationExistingContactLinkToast(
          {
            restaurantId,
            previousContactId: null,
            savedContactId: created.contact_id,
            manualInitialContactId: createFor.initialContactId,
          },
          existingContactBeforeSave,
        );
      }
      const createNotifyExtra = normalizeGuestNotifyMessage(guestNotifyMessage);
      const createDispatchOpts = createNotifyExtra
        ? { guestNotifyMessage: createNotifyExtra }
        : undefined;
      if (created && payload.notify_whatsapp) {
        const wa = await triggerReservationWhatsappDispatch(
          created.id,
          "created",
          createDispatchOpts,
        );
        const msg = whatsappDispatchUserMessage(wa);
        if (msg) toast.warning(msg);
        if (wa?.ok && wa.messageBody?.trim()) {
          onWhatsappDispatched?.({
            messageBody: wa.messageBody,
            messageId: wa.messageId,
            wahaMessageId: wa.wahaMessageId,
            threadContactId: wa.threadContactId,
          });
        }
      }
      if (created && payload.notify_email) {
        void triggerReservationEmailDispatch(
          created.id,
          "created",
          createDispatchOpts,
        ).then((em) => {
          const msg = emailDispatchUserMessage(em, { isSuperadmin });
          if (msg) toast.warning(msg);
        });
      }
      if (created && createNotifyExtra) {
        setGuestNotifyMessage("");
      }
      allowDrawerCloseRef.current = true;
      setTableSharePending(null);
      if (created) {
        const status = statuses.find((s) => s.id === payload.status_id);
        dispatchDashboardReservationCreateLivePatch({
          restaurantId: createFor.restaurantId,
          insert: {
            id: created.id,
            starts_at: payload.starts_at,
            ends_at: payload.ends_at,
            dwell_minutes: payload.dwell_minutes,
            guest_first_name: payload.guest_first_name,
            guest_last_name: payload.guest_last_name,
            party_size: payload.party_size,
            statusId: payload.status_id,
            statusCode: status?.code ?? "confirmed",
            statusName: status?.name ?? "Bestätigt",
            statusColorHex: status?.color_hex,
          },
        });
      }
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
    const restaurantId =
      reservation.restaurant_id ?? restaurantIdForFetch ?? "";
    if (!restaurantId) {
      toast.error("Restaurant konnte nicht zugeordnet werden.");
      return;
    }
    setSaving(true);
    const { error } = await deleteReservation({
      restaurantId,
      id: reservation.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void logReservationDeleteFromBrowser(reservation);
    toast.success("Reservierung gelöscht.");
    allowDrawerCloseRef.current = true;
    setConfirmDeleteOpen(false);
    onSaved();
  };

  const fieldClass = drawerFormFieldClassName;

  const drawerTwoColClass = "grid gap-3 sm:grid-cols-2 [&>*]:min-w-0";

  const canSave = isEdit || isCreate;
  const stackedSheetZClass = stackAboveInboxOverlay ? "z-[210]" : undefined;

  return (
    <>
    <Drawer
      open={open}
      onOpenChange={handleDrawerOpenChange}
      direction="bottom"
      repositionInputs={repositionInputs}
      handleOnly
    >
      <DrawerContent
        overlayClassName={stackedSheetZClass}
        className={cn(drawerContentClassName("formFixed"), stackedSheetZClass)}
      >
        <DrawerHeader className={cn(drawerFormHeaderClassName(6), "min-w-0 overflow-x-hidden")}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-left">
              <DrawerTitle className="text-xl font-semibold tracking-tight">
                {isCreate ? "Neue Reservierung" : "Reservierung bearbeiten"}
              </DrawerTitle>
              <div className="space-y-1">
                <DrawerDescription className="text-base leading-relaxed">
                  {isEdit && reservation ? (
                    <ReservationAccessMeta
                      reservationNumber={reservation.reservation_number}
                      guestPin={reservation.guest_pin}
                    />
                  ) : isCreate ? (
                    <ReservationAccessMeta
                      reservationNumber={nextReservationNumber}
                      guestPin={null}
                      numberProvisional={nextReservationNumber != null}
                      pinPending
                    />
                  ) : null}
                </DrawerDescription>
                {isEdit && reservation ? (
                  <ReservationCreatedHint
                    restaurantId={reservation.restaurant_id}
                    reservationId={reservation.id}
                    createdAt={reservation.created_at}
                    createdByProfileId={reservation.created_by_profile_id}
                    createdByProfile={reservation.created_by_profile}
                  />
                ) : null}
              </div>
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
          <DrawerFormBody>
            <div
              ref={scrollRef}
              data-vaul-no-drag
              className={drawerScrollAreaClassName(6, "min-w-0 overflow-x-hidden overscroll-x-none touch-pan-y")}
            >
              {isEdit && reservation ? (
                <ReservationChangeRequestPanel
                  reservation={reservation}
                  restaurantId={reservation.restaurant_id}
                  statuses={statuses}
                  onResolved={() => {
                    setProtocolRefreshKey((k) => k + 1);
                    onSaved();
                  }}
                />
              ) : null}
              <DrawerFormSection title="Termin & Status">
              <div className={drawerTwoColClass}>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="res-status" className="text-xs text-muted-foreground">
                    Status
                  </Label>
                  <Select
                    value={statusId}
                    items={statusItems}
                    onValueChange={(v) => {
                      if (typeof v !== "string") return;
                      setStatusId(v);
                      const next = statuses.find((s) => s.id === v);
                      if (next?.code !== "confirmed") setTableId("__none__");
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
                <div className="space-y-1.5">
                  <Label htmlFor="res-ps" className="text-xs text-muted-foreground">
                    Personen
                  </Label>
                  <Input
                    id="res-ps"
                    {...(touchTablet
                      ? touchNumericProps
                      : {
                          type: "number" as const,
                          min: 1,
                          max: RESERVATION_PARTY_SIZE_MAX_STAFF,
                        })}
                    value={partySize}
                    onChange={(e) =>
                      setPartySize(
                        touchTablet
                          ? digitsOnlyInput(e.target.value, 3)
                          : e.target.value,
                      )
                    }
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
                    htmlFor="res-time"
                    className="text-xs text-muted-foreground"
                  >
                    Uhrzeit
                  </Label>
                  <Input
                    id="res-time"
                    type="time"
                    value={timeHm}
                    onChange={(e) => setTimeHm(e.target.value)}
                    className={cn(fieldClass, "tabular-nums")}
                  />
                </div>
              </div>
              </DrawerFormSection>

              <DrawerFormSection title="Gast">
              <div className={drawerTwoColClass}>
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

              <div className={drawerTwoColClass}>
                <div className="space-y-1.5">
                  <Label htmlFor="res-phone-local" className="text-xs text-muted-foreground">
                    Telefon
                  </Label>
                  <GuestPhoneField
                    countryId="res-phone-country"
                    localId="res-phone-local"
                    countryIso={phoneCountryIso}
                    onCountryChange={setPhoneCountryIso}
                    localValue={phoneLocal}
                    onLocalChange={setPhoneLocal}
                    countries={countriesForPhone}
                    localInputMode={phoneLocalInputMode}
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

              {isEdit && reservation?.contact_id ? (
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 -mt-1">
                  <Contact className="size-3.5 shrink-0" aria-hidden />
                  Verknüpft mit{" "}
                  <Link
                    href={`/dashboard/kontakte/uebersicht?contact=${reservation.contact_id}`}
                    className="font-medium text-foreground underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Kontakt
                  </Link>
                </p>
              ) : null}

              <div className="space-y-1.5">
                <Label
                  htmlFor="res-internal-note"
                  className="text-xs text-muted-foreground"
                >
                  Interne Notiz
                </Label>
                <Textarea
                  id="res-internal-note"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  rows={3}
                  placeholder="Wünsche, Allergien, Anlass … (nur für das Team, keine Gast-Nachricht)"
                  className="min-h-[4.5rem] resize-y rounded-xl"
                />
              </div>
              </DrawerFormSection>

              <DrawerFormSection title="Tisch & Verweildauer">
              <div className={cn(drawerTwoColClass, "sm:grid-cols-[1fr_1fr]")}>
                <div className="space-y-1.5">
                  <Label htmlFor="res-dwell" className="text-xs text-muted-foreground">
                    Verweildauer (Min.)
                  </Label>
                  <Input
                    id="res-dwell"
                    {...(touchTablet
                      ? touchNumericProps
                      : { type: "number" as const, min: 15, max: 1440 })}
                    value={dwellDraft}
                    onChange={(e) =>
                      setDwellDraft(
                        touchTablet
                          ? digitsOnlyInput(e.target.value, 4)
                          : e.target.value,
                      )
                    }
                    className={cn(fieldClass, "tabular-nums")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-table" className="text-xs text-muted-foreground">
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
                      id="res-table"
                      size="sm"
                      disabled={!tableAssignmentAllowed}
                      className={appSelectTriggerAccentCn(
                        "h-11 min-h-11 w-full rounded-xl px-3 text-left text-sm font-normal",
                        !tableAssignmentAllowed && "cursor-not-allowed opacity-50",
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
                  {!tableAssignmentAllowed ? (
                    <p className="text-[11px] text-muted-foreground">
                      Tischzuordnung nur bei Status „Bestätigt“.
                    </p>
                  ) : null}
                </div>
              </div>
              </DrawerFormSection>

              {isEdit && reservation ? (
                <DrawerFormSection title="Nachrichten">
                <ReservationMessagesPanel
                  restaurantId={reservation.restaurant_id}
                  reservationId={reservation.id}
                  contactId={reservation.contact_id}
                  restaurantName={restaurantDisplayName}
                  hasPhone={hasPhone}
                  hasEmail={hasEmail}
                  defaultSendWhatsapp={notifyWhatsapp}
                  defaultSendEmail={notifyEmail}
                />
                </DrawerFormSection>
              ) : null}

              {isEdit && reservation ? (
                <DrawerFormSection title="Protokoll">
                  <ReservationProtocolSection
                    restaurantId={reservation.restaurant_id}
                    reservationId={reservation.id}
                    refreshKey={protocolRefreshKey}
                  />
                </DrawerFormSection>
              ) : null}

              <DrawerFormSection title="Benachrichtigungen & AGB">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="res-guest-notify-message"
                    className="text-xs text-muted-foreground"
                  >
                    Nachricht an den Gast
                  </Label>
                  <Textarea
                    id="res-guest-notify-message"
                    value={guestNotifyMessage}
                    onChange={(e) => setGuestNotifyMessage(e.target.value)}
                    rows={3}
                    maxLength={GUEST_NOTIFY_MESSAGE_MAX_CHARS}
                    placeholder="Optional — wird der Bestätigung/Benachrichtigung angehängt …"
                    className="min-h-[4.5rem] resize-y rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Wird bei der nächsten Status-Benachrichtigung (z. B.
                    Bestätigung) als „Nachricht:“ unter die Vorlage gehängt —
                    eine Nachricht statt zwei. Der Chat oben sendet weiterhin
                    sofort separat.
                  </p>
                </div>
                <div
                  className={cn(
                    "flex items-center justify-between gap-3",
                    !hasEmail && "opacity-50",
                  )}
                >
                  <span
                    id="res-notify-email"
                    className={reservationNotifyRowLabelClassName}
                  >
                    <Mail
                      className={reservationNotifyRowMailIconClassName}
                      aria-hidden
                    />
                    E-Mail-Benachrichtigung
                  </span>
                  <Switch
                    checked={notifyEmail}
                    disabled={!hasEmail}
                    onCheckedChange={(v) => setNotifyEmail(v === true)}
                    size="sm"
                    aria-labelledby="res-notify-email"
                  />
                </div>
                <div
                  className={cn(
                    "flex items-center justify-between gap-3",
                    !hasPhone && "opacity-50",
                  )}
                >
                  <span
                    id="res-notify-whatsapp"
                    className={reservationNotifyRowLabelClassName}
                  >
                    <WhatsAppGlyph
                      className={reservationNotifyRowWhatsAppIconClassName}
                    />
                    WhatsApp-Benachrichtigung
                  </span>
                  <Switch
                    checked={notifyWhatsapp}
                    disabled={!hasPhone}
                    onCheckedChange={(v) => setNotifyWhatsapp(v === true)}
                    size="sm"
                    aria-labelledby="res-notify-whatsapp"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span
                    id="res-terms"
                    className={reservationNotifyRowLabelClassName}
                  >
                    <TermsGlyph
                      className={reservationNotifyRowTermsIconClassName}
                    />
                    AGB akzeptiert
                  </span>
                  <Switch
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(v === true)}
                    size="sm"
                    aria-labelledby="res-terms"
                  />
                </div>
              </DrawerFormSection>
            </div>

            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              submitType="button"
              onSubmit={handleSave}
              submitPending={saving}
              submitDisabled={!canSave}
              className="touch-pan-y"
            />
          </DrawerFormBody>
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
