"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, MessageSquareText } from "lucide-react";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { EmbedSubmitButton, type EmbedSubmitPhase } from "@/components/embed/embed-submit-button";
import { GuestPhoneField } from "@/components/phone/guest-phone-field";
import {
  reservationNotifyRowLabelClassName,
  reservationNotifyRowMailIconClassName,
  reservationNotifyRowWhatsAppIconClassName,
} from "@/components/reservations/reservation-notify-toggle-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES_REFERENCE_FALLBACK } from "@/lib/constants/countries";
import { formatGuestPhone } from "@/lib/phone/guest-phone";
import { publicProfileContactErrorMessage } from "@/lib/contacts/public-profile-contact-errors";
import { cn } from "@/lib/utils";

/** Entspricht serverseitig PROFILE_CONTACT_MIN_SUBMIT_MS — kurze Denkpause vor Absenden. */
const SUBMIT_READY_MS = 2_500;

const CLIENT_ERROR_DE: Record<string, string> = {
  contact_required: "Bitte E-Mail oder Telefonnummer angeben.",
  invalid_email: "Bitte eine gültige E-Mail-Adresse eingeben.",
  invalid_phone: "Bitte eine gültige Telefonnummer eingeben.",
  message_required: "Bitte eine Nachricht eingeben.",
  first_name_required: "Bitte Vornamen eingeben.",
  confirmation_channel_required:
    "Bitte wählen, wie Du die Bestätigung erhalten möchtest.",
};

type ConfirmationChannel = "email" | "whatsapp";

type ContactChannels = {
  emailAvailable: boolean;
  whatsappAvailable: boolean;
};

type FieldErrors = Partial<
  Record<
    "first_name" | "last_name" | "email" | "phone" | "message" | "form" | "confirmation",
    string
  >
>;

export function PublicProfileContactForm({
  slug,
  restaurantName,
  className,
}: {
  slug: string;
  restaurantName: string;
  className?: string;
}) {
  const countries = useMemo(() => COUNTRIES_REFERENCE_FALLBACK, []);
  const openedAtRef = useRef(Date.now());
  const [submitReady, setSubmitReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [channels, setChannels] = useState<ContactChannels | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountryIso, setPhoneCountryIso] = useState("DE");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [confirmationChannel, setConfirmationChannel] =
    useState<ConfirmationChannel>("email");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<EmbedSubmitPhase>("idle");

  const hasEmail = Boolean(email.trim());
  const hasPhone = Boolean(phoneLocal.trim());
  const canConfirmEmail = Boolean(channels?.emailAvailable && hasEmail);
  const canConfirmWhatsapp = Boolean(
    channels?.whatsappAvailable && hasPhone,
  );
  const showConfirmationOptions = Boolean(
    channels && (channels.emailAvailable || channels.whatsappAvailable),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSubmitReady(true), SUBMIT_READY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/public/profile/${encodeURIComponent(slug)}/contact/channels`,
        );
        const data = (await res.json()) as ContactChannels;
        if (!cancel && res.ok) {
          setChannels(data);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!channels) return;
    if (confirmationChannel === "email" && canConfirmEmail) return;
    if (confirmationChannel === "whatsapp" && canConfirmWhatsapp) return;
    if (canConfirmEmail) {
      setConfirmationChannel("email");
    } else if (canConfirmWhatsapp) {
      setConfirmationChannel("whatsapp");
    }
  }, [channels, canConfirmEmail, canConfirmWhatsapp, confirmationChannel]);

  const validate = useCallback((): FieldErrors => {
    const errors: FieldErrors = {};
    if (!firstName.trim()) errors.first_name = CLIENT_ERROR_DE.first_name_required;
    if (!email.trim() && !phoneLocal.trim()) {
      errors.email = CLIENT_ERROR_DE.contact_required;
      errors.phone = CLIENT_ERROR_DE.contact_required;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = CLIENT_ERROR_DE.invalid_email;
    }
    if (!message.trim()) errors.message = CLIENT_ERROR_DE.message_required;

    if (showConfirmationOptions) {
      if (confirmationChannel === "email" && !canConfirmEmail) {
        errors.confirmation = CLIENT_ERROR_DE.confirmation_channel_required;
      } else if (confirmationChannel === "whatsapp" && !canConfirmWhatsapp) {
        errors.confirmation = CLIENT_ERROR_DE.confirmation_channel_required;
      } else if (!canConfirmEmail && !canConfirmWhatsapp) {
        errors.confirmation = CLIENT_ERROR_DE.confirmation_channel_required;
      }
    }

    return errors;
  }, [
    canConfirmEmail,
    canConfirmWhatsapp,
    confirmationChannel,
    email,
    firstName,
    message,
    phoneLocal,
    showConfirmationOptions,
  ]);

  const handleSubmit = async () => {
    if (!submitReady || submitted) return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const phoneFormatted = phoneLocal.trim()
      ? formatGuestPhone(phoneCountryIso, phoneLocal, countries)
      : null;

    if (phoneLocal.trim() && !phoneFormatted) {
      setFieldErrors({ phone: CLIENT_ERROR_DE.invalid_phone });
      return;
    }

    setPhase("loading");
    try {
      const res = await fetch(`/api/public/profile/${encodeURIComponent(slug)}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phoneFormatted,
          message: message.trim(),
          website,
          opened_at: openedAtRef.current,
          confirmation_channel: showConfirmationOptions
            ? confirmationChannel
            : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        setFieldErrors({
          form:
            data.message ??
            publicProfileContactErrorMessage(data.error ?? "invalid_request"),
        });
        setPhase("idle");
        return;
      }

      setSubmitted(true);
      setPhase("idle");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhoneLocal("");
      setMessage("");
      setWebsite("");
      openedAtRef.current = Date.now();
      setSubmitReady(false);
      window.setTimeout(() => setSubmitReady(true), SUBMIT_READY_MS);
      setFieldErrors({});
    } catch {
      setFieldErrors({
        form: "Verbindungsfehler. Bitte später erneut versuchen.",
      });
      setPhase("idle");
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-500 ease-in-out",
          submitted
            ? "pointer-events-none max-h-0 opacity-0"
            : "max-h-[2400px] opacity-100",
        )}
        aria-hidden={submitted}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquareText className="size-4 text-accent" aria-hidden />
            Nachricht schreiben
          </div>
          <p className="text-sm text-muted-foreground">
            Schreiben Sie {restaurantName} direkt — die Nachricht erscheint im
            Posteingang des Restaurants.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-contact-first-name">Vorname</Label>
              <Input
                id="profile-contact-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className="h-11 rounded-xl"
                disabled={phase === "loading"}
                aria-invalid={Boolean(fieldErrors.first_name)}
              />
              {fieldErrors.first_name ? (
                <p className="text-xs text-destructive">{fieldErrors.first_name}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-contact-last-name">Nachname</Label>
              <Input
                id="profile-contact-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className="h-11 rounded-xl"
                disabled={phase === "loading"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-contact-email">
              E-Mail{" "}
              <span className="font-normal text-muted-foreground">
                (E-Mail oder Telefon erforderlich)
              </span>
            </Label>
            <Input
              id="profile-contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-11 rounded-xl"
              disabled={phase === "loading"}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-contact-phone-local">Telefon</Label>
            <GuestPhoneField
              countryId="profile-contact-phone-country"
              localId="profile-contact-phone-local"
              countryIso={phoneCountryIso}
              onCountryChange={setPhoneCountryIso}
              localValue={phoneLocal}
              onLocalChange={setPhoneLocal}
              countries={countries}
              disabled={phase === "loading"}
              invalid={Boolean(fieldErrors.phone)}
            />
            {fieldErrors.phone ? (
              <p className="text-xs text-destructive">{fieldErrors.phone}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-contact-message">Nachricht</Label>
            <Textarea
              id="profile-contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="min-h-[7rem] rounded-xl"
              placeholder="Worum geht es?"
              disabled={phase === "loading"}
              aria-invalid={Boolean(fieldErrors.message)}
            />
            {fieldErrors.message ? (
              <p className="text-xs text-destructive">{fieldErrors.message}</p>
            ) : null}
          </div>

          {showConfirmationOptions ? (
            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-sm font-medium text-foreground">
                Bestätigung erhalten per
              </p>
              {channels?.emailAvailable ? (
                <div
                  className={cn(
                    "flex items-center justify-between gap-3 py-0.5",
                    !hasEmail && "opacity-50",
                  )}
                >
                  <span
                    id="profile-contact-confirm-email"
                    className={reservationNotifyRowLabelClassName}
                  >
                    <Mail
                      className={reservationNotifyRowMailIconClassName}
                      aria-hidden
                    />
                    E-Mail
                  </span>
                  <Switch
                    checked={confirmationChannel === "email"}
                    disabled={!canConfirmEmail || phase === "loading"}
                    onCheckedChange={(on) => {
                      if (on) setConfirmationChannel("email");
                    }}
                    size="sm"
                    aria-labelledby="profile-contact-confirm-email"
                  />
                </div>
              ) : null}
              {channels?.whatsappAvailable ? (
                <div
                  className={cn(
                    "flex items-center justify-between gap-3 py-0.5",
                    !hasPhone && "opacity-50",
                  )}
                >
                  <span
                    id="profile-contact-confirm-whatsapp"
                    className={reservationNotifyRowLabelClassName}
                  >
                    <WhatsAppGlyph
                      className={reservationNotifyRowWhatsAppIconClassName}
                    />
                    WhatsApp
                  </span>
                  <Switch
                    checked={confirmationChannel === "whatsapp"}
                    disabled={!canConfirmWhatsapp || phase === "loading"}
                    onCheckedChange={(on) => {
                      if (on) setConfirmationChannel("whatsapp");
                    }}
                    size="sm"
                    aria-labelledby="profile-contact-confirm-whatsapp"
                  />
                </div>
              ) : null}
              {fieldErrors.confirmation ? (
                <p className="text-xs text-destructive">{fieldErrors.confirmation}</p>
              ) : null}
            </div>
          ) : null}

          {fieldErrors.form ? (
            <p className="text-sm text-destructive">{fieldErrors.form}</p>
          ) : null}

          <EmbedSubmitButton
            phase={phase}
            idleLabel="Nachricht senden"
            loadingLabel="Wird gesendet …"
            disabled={!submitReady}
            onClick={() => void handleSubmit()}
          />

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
      </div>

      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity,transform] duration-500 ease-in-out",
          submitted
            ? "max-h-48 translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 translate-y-2 opacity-0",
        )}
        aria-live="polite"
      >
        <p className="py-8 text-center text-base text-foreground">
          Vielen Dank für Deine Nachricht. Wir melden uns.
        </p>
      </div>
    </div>
  );
}
