"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Mail, Pencil } from "lucide-react";
import { GuestPhoneCountrySelect } from "@/components/phone/guest-phone-country-select";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import {
  EmbedSlidingSegmentTabs,
  type EmbedSlidingSegmentTab,
} from "@/components/embed/embed-sliding-segment-tabs";
import {
  EmbedBookingSuccess,
  type EmbedBookingSuccessDetails,
} from "@/components/embed/embed-booking-success";
import { EmbedReservationTermsSheet } from "@/components/embed/embed-reservation-terms-sheet";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { isGwadaEmbedHostMode } from "@/lib/embed/embed-menu-scroll";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";
import {
  EmbedSubmitButton,
  type EmbedSubmitPhase,
} from "@/components/embed/embed-submit-button";
import { TermsGlyph } from "@/components/icons/terms-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  reservationNotifyRowMailIconClassName,
  reservationNotifyRowTermsIconClassName,
  reservationNotifyRowWhatsAppIconClassName,
} from "@/components/reservations/reservation-notify-toggle-styles";
import { DatePickerField } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CountryReference } from "@/lib/constants/countries";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantIsoToYmdHm,
  ymdHmToRestaurantIso,
} from "@/lib/restaurant/restaurant-timezone";
import {
  earliestBookableYmd,
  filterPublicBookableTimeSlots,
  isYmdBeforeEarliestBookable,
  isYmdHmPublicBookable,
  resolveEmbedBookingDefaultYmdHm,
} from "@/lib/reservations/embed-booking-datetime";
import {
  filterSlotsForMinMinutesBeforeClosing,
  publicTimeSlotsForDay,
  type PublicEmbedRestaurant,
  type PublicGuestReservation,
} from "@/lib/reservations/public-embed-shared";
import { formatGuestPhone, parseGuestPhone } from "@/lib/phone/guest-phone";
import {
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
  reservationGuestFirstNameForForm,
} from "@/lib/reservations/reservation-guest-name";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type Tab = "book" | "manage";

export type EmbedReservationProfileTermsSheet = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function scheduleTermsSheetOpen(onOpenChange: (open: boolean) => void) {
  window.requestAnimationFrame(() => {
    onOpenChange(true);
  });
}

const RESERVATION_SEGMENT_TABS: readonly EmbedSlidingSegmentTab<Tab>[] = [
  { id: "book", label: "Buchen", icon: CalendarDays },
  { id: "manage", label: "Ändern", icon: Pencil },
];

type EmbedFieldErrors = {
  date?: boolean;
  time?: boolean;
  party?: boolean;
  lastName?: boolean;
  contact?: boolean;
  notifyChannel?: boolean;
  terms?: boolean;
  manageNumber?: boolean;
  managePin?: boolean;
};

const ERROR_DE: Record<string, string> = {
  invalid_request: "Bitte alle Pflichtfelder prüfen.",
  terms_required: "Bitte die Bedingungen bestätigen.",
  contact_required: "Bitte Telefon oder E-Mail angeben.",
  notify_channel_required:
    "Bitte mindestens E-Mail- oder WhatsApp-Benachrichtigung aktivieren.",
  outside_opening_hours: "Diese Uhrzeit liegt außerhalb der Öffnungszeiten.",
  booking_lead_time:
    "Der gewählte Termin liegt vor der Mindest-Vorlaufzeit des Restaurants.",
  invalid_credentials: "Nummer oder PIN ist ungültig.",
  not_editable: "Diese Reservierung kann nicht mehr geändert werden.",
  not_found: "Restaurant nicht gefunden oder nicht veröffentlicht.",
  create_failed: "Reservierung konnte nicht angelegt werden.",
  update_failed: "Änderung konnte nicht gespeichert werden.",
};

const FIELD_ERROR_HINTS: Record<keyof EmbedFieldErrors, string> = {
  date: "Bitte ein Datum wählen.",
  time: "Bitte eine gültige Uhrzeit wählen.",
  party: "Bitte Personenzahl angeben (mindestens 1).",
  lastName: "Nachname ist Pflicht.",
  contact: "Telefon oder E-Mail angeben.",
  notifyChannel: "Mindestens E-Mail- oder WhatsApp-Benachrichtigung aktivieren.",
  terms: "Bitte die Bedingungen bestätigen.",
  manageNumber: "Reservierungsnummer eingeben.",
  managePin: "PIN eingeben.",
};

function EmbedFieldErrorHint({
  field,
  errors,
}: {
  field: keyof EmbedFieldErrors;
  errors: EmbedFieldErrors;
}) {
  if (!errors[field]) return null;
  return <p className="text-xs text-destructive">{FIELD_ERROR_HINTS[field]}</p>;
}

function errorMessage(code: string | undefined): string {
  if (!code) return "Ein Fehler ist aufgetreten.";
  return ERROR_DE[code] ?? ERROR_DE.invalid_request;
}

function buildEndsIso(startsIso: string, dwellMinutes: number): string {
  const end = new Date(startsIso);
  end.setMinutes(end.getMinutes() + dwellMinutes);
  return end.toISOString();
}

function hasGuestContactFilled(
  phoneCountryIso: string,
  phoneLocal: string,
  email: string,
  countries: CountryReference[],
): boolean {
  const phone = formatGuestPhone(phoneCountryIso, phoneLocal, countries);
  return Boolean(phone?.trim()) || Boolean(email.trim());
}

export function EmbedReservationWidget({
  config,
  countries,
  variant = "embed",
  profileTermsSheet,
  textTheme = "dark",
}: {
  config: PublicEmbedRestaurant;
  countries: CountryReference[];
  variant?: "embed" | "profileSheet";
  /** Profil-App-Sheet: Terms-Drawer auf Overlay-Ebene (nicht im Scroll-Inhalt). */
  profileTermsSheet?: EmbedReservationProfileTermsSheet;
  textTheme?: EmbedTextTheme;
}) {
  const profileSheet = variant === "profileSheet";
  const [hostMode, setHostMode] = useState(false);
  const [internalTermsSheetOpen, setInternalTermsSheetOpen] = useState(false);

  const termsSheetOpen = profileTermsSheet?.open ?? internalTermsSheetOpen;
  const setTermsSheetOpen =
    profileTermsSheet?.onOpenChange ?? setInternalTermsSheetOpen;
  const renderTermsSheetInsideWidget = !profileSheet;

  useEffect(() => {
    setHostMode(isGwadaEmbedHostMode());
  }, []);

  const [tab, setTab] = useState<Tab>("book");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EmbedFieldErrors>({});
  const [bookPhase, setBookPhase] = useState<EmbedSubmitPhase>("idle");
  const [managePhase, setManagePhase] = useState<EmbedSubmitPhase>("idle");
  const [bookSuccess, setBookSuccess] = useState<EmbedBookingSuccessDetails | null>(
    null,
  );
  const [manageSuccess, setManageSuccess] = useState<{
    details: EmbedBookingSuccessDetails;
    changeRequest: boolean;
  } | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneCountryIso, setPhoneCountryIso] = useState("DE");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [dateYmd, setDateYmd] = useState(
    () => resolveEmbedBookingDefaultYmdHm(config).ymd,
  );
  const [timeHm, setTimeHm] = useState(
    () => resolveEmbedBookingDefaultYmdHm(config).hm,
  );
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [website, setWebsite] = useState("");

  const [manageNumber, setManageNumber] = useState("");
  const [managePin, setManagePin] = useState("");
  const [loadedReservation, setLoadedReservation] =
    useState<PublicGuestReservation | null>(null);

  const dayDate = useMemo(() => {
    const [y, m, d] = dateYmd.split("-").map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1);
  }, [dateYmd]);

  const earliestYmd = useMemo(() => earliestBookableYmd(config), [config]);

  const enforceBookingLead = tab === "book" || !loadedReservation;

  const timeSlots = useMemo(() => {
    const day = dayDate;
    if (!enforceBookingLead) {
      return filterSlotsForMinMinutesBeforeClosing(
        publicTimeSlotsForDay(config, day),
        config,
        dateYmd,
        config.minMinutesBeforeClosing,
      );
    }
    return filterPublicBookableTimeSlots(config, dateYmd);
  }, [config, dateYmd, dayDate, enforceBookingLead]);

  const hasEmail = Boolean(email.trim());
  const hasPhone = Boolean(
    formatGuestPhone(phoneCountryIso, phoneLocal, countries)?.trim(),
  );

  const notifyEmailInvalid =
    Boolean(fieldErrors.notifyChannel) && !notifyEmail && hasEmail;
  const notifyWhatsappInvalid =
    Boolean(fieldErrors.notifyChannel) && !notifyWhatsapp && hasPhone;

  useEffect(() => {
    if (timeSlots.length === 0) return;
    if (!timeSlots.includes(timeHm)) {
      setTimeHm(timeSlots[0]!);
    }
  }, [timeSlots, timeHm]);

  const handleTabChange = useCallback((next: Tab) => {
    setTab(next);
    setError(null);
    setFieldErrors({});
    if (next === "manage") {
      setBookSuccess(null);
      setManageSuccess(null);
      setBookPhase("idle");
      setManagePhase("idle");
    }
  }, []);

  const resetBookForm = useCallback(() => {
    setFirstName("");
    setLastName("");
    setPhoneLocal("");
    setEmail("");
    setPartySize("2");
    setTermsAccepted(false);
    setWebsite("");
    setNotifyEmail(false);
    setNotifyWhatsapp(false);
    const slot = resolveEmbedBookingDefaultYmdHm(config);
    setDateYmd(slot.ymd);
    setTimeHm(slot.hm);
  }, [config]);

  const applyReservationToForm = useCallback(
    (r: PublicGuestReservation) => {
      setFirstName(reservationGuestFirstNameForForm(r.guest_first_name));
      setLastName(r.guest_last_name);
      const parsed = parseGuestPhone(r.guest_phone, countries, "DE");
      setPhoneCountryIso(parsed.iso2);
      setPhoneLocal(parsed.local);
      setEmail(r.guest_email ?? "");
      setPartySize(String(r.party_size));
      const timeZone = config.timezone?.trim() || DEFAULT_RESTAURANT_TIMEZONE;
      const { ymd, hm } = restaurantIsoToYmdHm(r.starts_at, timeZone);
      setDateYmd(ymd);
      setTimeHm(hm);
      setNotifyEmail(r.notify_email);
      setNotifyWhatsapp(r.notify_whatsapp);
      setTermsAccepted(r.terms_accepted);
    },
    [config.timezone, countries],
  );

  const buildPayload = () => {
    const ps = Number(partySize);
    if (!Number.isFinite(ps) || ps < 1) return null;
    const timeZone = config.timezone?.trim() || DEFAULT_RESTAURANT_TIMEZONE;
    const startsIso = ymdHmToRestaurantIso(dateYmd, timeHm, timeZone);
    const endsIso = buildEndsIso(startsIso, config.defaultDwellMinutes);
    return {
      guest_first_name: normalizeReservationGuestFirstName(firstName),
      guest_last_name: normalizeReservationGuestLastName(lastName),
      guest_phone: formatGuestPhone(phoneCountryIso, phoneLocal, countries),
      guest_email: email.trim() || null,
      party_size: ps,
      starts_at: startsIso,
      ends_at: endsIso,
      notify_email: notifyEmail,
      notify_whatsapp: notifyWhatsapp,
      terms_accepted: termsAccepted,
      website,
      slug: config.slug,
    };
  };

  const collectFieldErrors = (
    payload: NonNullable<ReturnType<typeof buildPayload>>,
  ): EmbedFieldErrors => {
    const errors: EmbedFieldErrors = {};
    if (!dateYmd.trim()) errors.date = true;
    if (
      enforceBookingLead &&
      dateYmd.trim() &&
      isYmdBeforeEarliestBookable(dateYmd, earliestYmd)
    ) {
      errors.date = true;
    }
    if (timeSlots.length === 0) errors.time = true;
    if (
      enforceBookingLead &&
      dateYmd.trim() &&
      timeSlots.length > 0 &&
      !isYmdHmPublicBookable(config, dateYmd, timeHm)
    ) {
      errors.time = true;
    }
    const ps = Number(partySize);
    if (!Number.isFinite(ps) || ps < 1) errors.party = true;
    if (!payload.guest_last_name.trim()) errors.lastName = true;
    if (!hasGuestContactFilled(phoneCountryIso, phoneLocal, email, countries)) {
      errors.contact = true;
    }
    if (!termsAccepted) errors.terms = true;
    if (!payload.notify_email && !payload.notify_whatsapp) {
      errors.notifyChannel = true;
    }
    return errors;
  };

  const clearFieldError = (key: keyof EmbedFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const successDetailsFromPayload = (
    payload: NonNullable<ReturnType<typeof buildPayload>>,
    reservationNumber: number,
    guestPin: string,
  ): EmbedBookingSuccessDetails => ({
    reservation_number: reservationNumber,
    guest_pin: guestPin,
    guest_first_name: payload.guest_first_name,
    guest_last_name: payload.guest_last_name,
    guest_phone: payload.guest_phone,
    guest_email: payload.guest_email,
    party_size: payload.party_size,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
  });

  const handleBook = async () => {
    setError(null);
    setBookSuccess(null);
    const payload = buildPayload();
    if (!payload) {
      setFieldErrors({
        date: true,
        time: timeSlots.length === 0,
        party: true,
      });
      setError("Bitte markierte Felder prüfen.");
      return;
    }
    const errors = collectFieldErrors(payload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Bitte markierte Felder prüfen.");
      return;
    }
    setFieldErrors({});
    setBookPhase("loading");
    try {
      const res = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        reservation_number?: number;
        guest_pin?: string;
      };
      if (!res.ok || !body.reservation_number || !body.guest_pin) {
        setBookPhase("idle");
        setError(errorMessage(body.error));
        return;
      }
      setBookPhase("success");
      setBookSuccess(
        successDetailsFromPayload(
          payload,
          body.reservation_number,
          body.guest_pin,
        ),
      );
      resetBookForm();
    } catch {
      setBookPhase("idle");
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    }
  };

  const handleManageLoad = async () => {
    setError(null);
    setManageSuccess(null);
    const nrTrim = manageNumber.trim();
    const num = Number(nrTrim);
    const loadErrors: EmbedFieldErrors = {};
    if (!nrTrim || !Number.isFinite(num) || num < 1) loadErrors.manageNumber = true;
    if (managePin.length !== 6) loadErrors.managePin = true;
    if (Object.keys(loadErrors).length > 0) {
      setFieldErrors(loadErrors);
      setError("Bitte markierte Felder prüfen.");
      return;
    }
    setFieldErrors({});
    setManagePhase("loading");
    try {
      const res = await fetch("/api/public/reservations/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "load",
          slug: config.slug,
          reservation_number: num,
          pin: managePin,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        reservation?: PublicGuestReservation;
      };
      setManagePhase("idle");
      if (!res.ok || !body.reservation) {
        setError(errorMessage(body.error));
        setLoadedReservation(null);
        return;
      }
      setLoadedReservation(body.reservation);
      applyReservationToForm(body.reservation);
    } catch {
      setManagePhase("idle");
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    }
  };

  const handleManageSave = async () => {
    if (!loadedReservation) return;
    setError(null);
    setManageSuccess(null);
    const payload = buildPayload();
    if (!payload) {
      setFieldErrors({ party: true, lastName: true });
      return;
    }
    const errors = collectFieldErrors(payload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Bitte markierte Felder prüfen.");
      return;
    }
    setFieldErrors({});
    setManagePhase("loading");
    try {
      const res = await fetch("/api/public/reservations/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          ...payload,
          reservation_number: loadedReservation.reservation_number,
          pin: managePin,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        change_request?: boolean;
      };
      if (!res.ok) {
        setManagePhase("idle");
        setError(errorMessage(body.error));
        return;
      }
      setManagePhase("success");
      setManageSuccess({
        changeRequest: Boolean(body.change_request),
        details: {
          ...successDetailsFromPayload(
            payload,
            loadedReservation.reservation_number,
            "******",
          ),
        },
      });
    } catch {
      setManagePhase("idle");
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    }
  };

  const formFields = (
    <div className="w-full min-w-0 space-y-4">
      <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:gap-3">
        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs sm:text-sm">Datum</Label>
          <DatePickerField
            fullWidth
            minYmd={enforceBookingLead ? earliestYmd : undefined}
            value={dateYmd}
            onChange={(ymd) => {
              const next = ymd ?? earliestYmd;
              setDateYmd(
                isYmdBeforeEarliestBookable(next, earliestYmd)
                  ? earliestYmd
                  : next,
              );
              clearFieldError("date");
              clearFieldError("time");
            }}
            className={cn(
              "h-10 rounded-xl",
              fieldErrors.date &&
                "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
            )}
          />
          <EmbedFieldErrorHint field="date" errors={fieldErrors} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs sm:text-sm">Uhrzeit</Label>
          {timeSlots.length === 0 ? (
            <p
              className={cn(
                "flex h-10 items-center rounded-xl px-2 text-xs text-muted-foreground sm:text-sm",
                fieldErrors.time &&
                  "border border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
              )}
            >
              Geschlossen
            </p>
          ) : (
            <Select
              value={timeHm}
              onValueChange={(v) => {
                setTimeHm(String(v));
                clearFieldError("time");
              }}
            >
              <SelectTrigger
                aria-invalid={fieldErrors.time || undefined}
                className={appSelectTriggerAccentCn("h-10 w-full rounded-xl")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <EmbedFieldErrorHint field="time" errors={fieldErrors} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="embed-party" className="text-xs sm:text-sm">
            Pers.
          </Label>
          <Input
            id="embed-party"
            type="number"
            min={1}
            max={30}
            value={partySize}
            onChange={(e) => {
              setPartySize(e.target.value);
              clearFieldError("party");
            }}
            aria-invalid={fieldErrors.party || undefined}
            className="h-10 rounded-xl"
          />
          <EmbedFieldErrorHint field="party" errors={fieldErrors} />
        </div>
      </div>

      <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="embed-last">Nachname</Label>
          <Input
            id="embed-last"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              clearFieldError("lastName");
            }}
            autoComplete="family-name"
            aria-invalid={fieldErrors.lastName || undefined}
            className="h-10 rounded-xl"
          />
          <EmbedFieldErrorHint field="lastName" errors={fieldErrors} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="embed-first">Vorname</Label>
          <Input
            id="embed-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      <div className="w-full min-w-0 space-y-3">
        <div className="space-y-1.5">
          <Label>Telefon</Label>
          <div className="flex gap-2">
            <GuestPhoneCountrySelect
              value={phoneCountryIso}
              invalid={fieldErrors.contact}
              onValueChange={(iso2) => {
                setPhoneCountryIso(iso2);
                clearFieldError("contact");
              }}
              countries={countries}
            />
            <Input
              value={phoneLocal}
              onChange={(e) => {
                setPhoneLocal(e.target.value);
                clearFieldError("contact");
              }}
              inputMode="tel"
              autoComplete="tel-national"
              aria-invalid={fieldErrors.contact || undefined}
              className="h-10 min-w-0 flex-1 rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="embed-email">E-Mail</Label>
          <Input
            id="embed-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError("contact");
            }}
            autoComplete="email"
            aria-invalid={fieldErrors.contact || undefined}
            className="h-10 rounded-xl"
          />
        </div>
        <EmbedFieldErrorHint field="contact" errors={fieldErrors} />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
        <div
          className={cn(
            "flex items-center justify-between gap-3 py-0.5",
            !hasEmail && "opacity-50",
          )}
        >
          <span
            id="embed-notify-email"
            className="flex min-w-0 items-center gap-2.5 text-sm leading-snug"
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
            aria-invalid={notifyEmailInvalid || undefined}
            onCheckedChange={(v) => {
              setNotifyEmail(v === true);
              if (v === true) clearFieldError("notifyChannel");
            }}
            size="sm"
            aria-labelledby="embed-notify-email"
          />
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-3 py-0.5",
            !hasPhone && "opacity-50",
          )}
        >
          <span
            id="embed-notify-whatsapp"
            className="flex min-w-0 items-center gap-2.5 text-sm leading-snug"
          >
            <WhatsAppGlyph
              className={reservationNotifyRowWhatsAppIconClassName}
            />
            WhatsApp-Benachrichtigung
          </span>
          <Switch
            checked={notifyWhatsapp}
            disabled={!hasPhone}
            aria-invalid={notifyWhatsappInvalid || undefined}
            onCheckedChange={(v) => {
              setNotifyWhatsapp(v === true);
              if (v === true) clearFieldError("notifyChannel");
            }}
            size="sm"
            aria-labelledby="embed-notify-whatsapp"
          />
        </div>
      </div>
      <EmbedFieldErrorHint field="notifyChannel" errors={fieldErrors} />

      <div
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 p-3"
        data-profile-sheet-no-pull
      >
        <span
          id="embed-terms-label"
          className="flex min-w-0 flex-1 items-center gap-2.5 text-sm leading-snug"
        >
          <TermsGlyph className={reservationNotifyRowTermsIconClassName} />
          <span>
            <button
              type="button"
              className="font-medium text-foreground underline decoration-foreground/50 underline-offset-2 hover:decoration-foreground"
              onClick={() => scheduleTermsSheetOpen(setTermsSheetOpen)}
            >
              Bedingungen
            </button>{" "}
            akzeptieren
          </span>
        </span>
        <Switch
          checked={termsAccepted}
          aria-invalid={fieldErrors.terms || undefined}
          onCheckedChange={(v) => {
            const accepted = v === true;
            setTermsAccepted(accepted);
            if (accepted) {
              scheduleTermsSheetOpen(setTermsSheetOpen);
              clearFieldError("terms");
            } else {
              setTermsSheetOpen(false);
            }
          }}
          size="sm"
          aria-labelledby="embed-terms-label"
        />
      </div>
      <EmbedFieldErrorHint field="terms" errors={fieldErrors} />
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
    </div>
  );

  const embedFooterText = config.embedFormFooterText?.trim() ?? "";

  const embedFormFooter =
    embedFooterText.length > 0 ? (
      <p className="text-center text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap pt-1">
        {embedFooterText}
      </p>
    ) : null;

  const resizeDeps = [
    tab,
    error,
    bookSuccess,
    manageSuccess,
    loadedReservation,
    bookPhase,
    managePhase,
    timeSlots.length,
    fieldErrors,
    termsSheetOpen,
    embedFooterText,
  ];

  return (
    <EmbedAccentRoot
      accentHex={config.accentHex}
      textTheme={textTheme}
      brandFooter={!profileSheet}
    >
      {renderTermsSheetInsideWidget ? (
        <EmbedReservationTermsSheet
          open={termsSheetOpen}
          onOpenChange={setTermsSheetOpen}
          restaurantName={config.name}
        />
      ) : null}
      <EmbedResizeReporter deps={resizeDeps} widget="reservation" />
      <div
        className={cn(
          "w-full min-w-0 px-4 py-5 sm:px-5",
          profileSheet && "pt-3",
        )}
      >
        <EmbedSlidingSegmentTabs
          tabs={RESERVATION_SEGMENT_TABS}
          value={tab}
          onChange={handleTabChange}
          className="mb-4"
          aria-label="Reservierung"
        />

        {error ? (
          <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {tab === "book" ? (
          <div className="w-full min-w-0 space-y-4">
            {bookSuccess ? (
              <EmbedBookingSuccess
                details={bookSuccess}
                timeZone={config.timezone?.trim() || DEFAULT_RESTAURANT_TIMEZONE}
              />
            ) : (
              <>
                {formFields}
                {embedFormFooter}
                <EmbedSubmitButton
                  phase={bookPhase}
                  idleLabel="Reservierung absenden"
                  disabled={timeSlots.length === 0}
                  onClick={() => void handleBook()}
                />
              </>
            )}
          </div>
        ) : (
          <div className="w-full min-w-0 space-y-4">
            <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="embed-nr">Reservierungs-Nr.</Label>
                <Input
                  id="embed-nr"
                  inputMode="numeric"
                  value={manageNumber}
                  onChange={(e) => {
                    setManageNumber(e.target.value);
                    clearFieldError("manageNumber");
                  }}
                  aria-invalid={fieldErrors.manageNumber || undefined}
                  className={cn(
                    "h-10 rounded-xl",
                    fieldErrors.manageNumber &&
                      "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
                  )}
                />
                <EmbedFieldErrorHint field="manageNumber" errors={fieldErrors} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="embed-pin">PIN (6 Ziffern)</Label>
                <Input
                  id="embed-pin"
                  inputMode="numeric"
                  maxLength={6}
                  value={managePin}
                  onChange={(e) => {
                    setManagePin(e.target.value.replace(/\D/g, "").slice(0, 6));
                    clearFieldError("managePin");
                  }}
                  aria-invalid={fieldErrors.managePin || undefined}
                  className={cn(
                    "h-10 rounded-xl font-mono tracking-widest",
                    fieldErrors.managePin &&
                      "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
                  )}
                />
                <EmbedFieldErrorHint field="managePin" errors={fieldErrors} />
              </div>
            </div>
            {manageSuccess ? (
              <EmbedBookingSuccess
                details={manageSuccess.details}
                changeRequest={manageSuccess.changeRequest}
                timeZone={config.timezone?.trim() || DEFAULT_RESTAURANT_TIMEZONE}
              />
            ) : !loadedReservation ? (
              <EmbedSubmitButton
                phase={managePhase === "loading" ? "loading" : "idle"}
                idleLabel="Reservierung laden"
                loadingLabel="Prüfe…"
                onClick={() => void handleManageLoad()}
              />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Reservierung #{loadedReservation.reservation_number}
                </p>
                {formFields}
                {embedFormFooter}
                <EmbedSubmitButton
                  phase={managePhase}
                  idleLabel="Änderungen absenden"
                  loadingLabel="Wird gesendet…"
                  disabled={timeSlots.length === 0}
                  onClick={() => void handleManageSave()}
                />
              </>
            )}
          </div>
        )}

        {hostMode ? (
          <p className="mt-4 text-center text-[10px] text-muted-foreground">
            Bereitgestellt von gwada
          </p>
        ) : null}
      </div>
    </EmbedAccentRoot>
  );
}
