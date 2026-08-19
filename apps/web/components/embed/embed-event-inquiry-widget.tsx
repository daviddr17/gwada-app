"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { GuestPhoneCountrySelect } from "@/components/phone/guest-phone-country-select";
import { useTranslations } from "next-intl";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import {
  EmbedEventInquiryPackages,
  selectedEventInquiryPackageIds,
  type EventInquiryPackageSelection,
} from "@/components/embed/embed-event-inquiry-packages";
import {
  EmbedEventInquiryMenus,
  selectionWithMenu,
} from "@/components/embed/embed-event-inquiry-menus";
import { EmbedReservationTermsSheet } from "@/components/embed/embed-reservation-terms-sheet";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import type { AppLocale } from "@/i18n/config";
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
import { DatePickerField, formScheduleTimeInputClassName } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CountryReference } from "@/lib/constants/countries";
import {
  restaurantTodayYmd,
  ymdHmToRestaurantIso,
} from "@/lib/restaurant/restaurant-timezone";
import type { EmbedReservationProfileTermsSheet } from "@/components/embed/embed-reservation-widget";
import type { PublicEmbedRestaurant } from "@/lib/reservations/public-embed-shared";
import { formatGuestPhone } from "@/lib/phone/guest-phone";
import {
  normalizeReservationGuestCompany,
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
} from "@/lib/reservations/reservation-guest-name";
import { RESERVATION_PARTY_SIZE_MAX_STAFF } from "@/lib/reservations/reservation-party-size";
import { cn } from "@/lib/utils";
import {
  EMPTY_EVENT_MENU_SELECTION,
  eventMenuEstimateTotal,
  findEventMenuCourseIssues,
  type EventMenuSelection,
  type PublicEventMenu,
} from "@/lib/events/event-menu";
import {
  eventPackageEstimateTotal,
  type PublicEventPackage,
} from "@/lib/events/event-package";
import { formatMenuPrice } from "@/lib/menu/format-menu-price";

type FieldErrors = {
  date?: boolean;
  time?: boolean;
  party?: boolean;
  lastName?: boolean;
  contact?: boolean;
  notifyChannel?: boolean;
  terms?: boolean;
  menu?: boolean;
};

const API_ERROR_KEYS: Record<string, string> = {
  invalid_request: "errorInvalidRequest",
  terms_required: "errorTermsRequired",
  contact_required: "errorContactRequired",
  notify_channel_required: "errorNotifyChannel",
  rate_limit_exceeded: "errorRateLimit",
  not_found: "errorNotFound",
  create_failed: "errorCreateFailed",
  last_name_required: "errorInvalidRequest",
  invalid_packages: "errorInvalidPackages",
  invalid_menu: "errorInvalidMenu",
};

function scheduleTermsSheetOpen(onOpenChange: (open: boolean) => void) {
  window.requestAnimationFrame(() => {
    onOpenChange(true);
  });
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

export function EmbedEventInquiryWidget({
  config,
  countries,
  textTheme = "dark",
  sourceLocale = "de",
  variant = "embed",
  profileTermsSheet,
}: {
  config: PublicEmbedRestaurant;
  countries: CountryReference[];
  textTheme?: EmbedTextTheme;
  sourceLocale?: AppLocale;
  variant?: "embed" | "profileSheet";
  profileTermsSheet?: EmbedReservationProfileTermsSheet;
}) {
  const t = useTranslations("Embed.eventInquiry");
  const tr = useTranslations("Embed.reservation");
  const profileSheet = variant === "profileSheet";
  const [dateYmd, setDateYmd] = useState(() =>
    restaurantTodayYmd(config.timezone),
  );
  const [timeHm, setTimeHm] = useState("18:00");
  const [partySize, setPartySize] = useState("20");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [company, setCompany] = useState("");
  const [phoneCountryIso, setPhoneCountryIso] = useState(
    countries.find((c) => c.iso2 === "DE")?.iso2 ?? countries[0]?.iso2 ?? "DE",
  );
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [occasion, setOccasion] = useState("");
  const [message, setMessage] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [internalTermsOpen, setInternalTermsOpen] = useState(false);
  const [website, setWebsite] = useState("");
  const [phase, setPhase] = useState<EmbedSubmitPhase>("idle");
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [packages, setPackages] = useState<PublicEventPackage[]>([]);
  const [menus, setMenus] = useState<PublicEventMenu[]>([]);
  const [menuSelection, setMenuSelection] = useState<EventMenuSelection>(
    EMPTY_EVENT_MENU_SELECTION,
  );
  const [packageSelection, setPackageSelection] =
    useState<EventInquiryPackageSelection>({
      buffetId: null,
      drinksId: null,
      extraIds: [],
    });

  const termsSheetOpen = profileTermsSheet?.open ?? internalTermsOpen;
  const setTermsSheetOpen =
    profileTermsSheet?.onOpenChange ?? setInternalTermsOpen;
  const renderTermsSheetInsideWidget = !profileSheet;

  const hasEmail = Boolean(email.trim());
  const hasPhone = Boolean(
    formatGuestPhone(phoneCountryIso, phoneLocal, countries)?.trim(),
  );

  const clearFieldError = useCallback((field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const errorMessage = useCallback(
    (code: string | undefined) => {
      if (!code) return t("genericError");
      const key = API_ERROR_KEYS[code];
      return key ? t(key as Parameters<typeof t>[0]) : t("errorInvalidRequest");
    },
    [t],
  );

  const hint = useCallback(
    (field: keyof FieldErrors) => {
      switch (field) {
        case "date":
          return tr("hintDate");
        case "time":
          return tr("hintTime");
        case "party":
          return tr("hintParty");
        case "lastName":
          return tr("hintLastName");
        case "contact":
          return tr("hintContact");
        case "notifyChannel":
          return tr("hintNotifyChannel");
        case "terms":
          return tr("hintTerms");
        case "menu":
          return t("hintMenu");
        default:
          return "";
      }
    },
    [t, tr],
  );

  const footerText = useMemo(
    () => config.embedFormFooterText?.trim() || null,
    [config.embedFormFooterText],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({ slug: config.slug });
        const [packagesRes, menusRes] = await Promise.all([
          fetch(`/api/public/event-packages?${params}`),
          fetch(`/api/public/event-menus?${params}`),
        ]);
        const packagesData = (await packagesRes.json().catch(() => ({}))) as {
          packages?: PublicEventPackage[];
        };
        const menusData = (await menusRes.json().catch(() => ({}))) as {
          menus?: PublicEventMenu[];
        };
        if (cancelled) return;
        if (Array.isArray(packagesData.packages)) {
          setPackages(packagesData.packages);
        }
        if (Array.isArray(menusData.menus)) {
          setMenus(menusData.menus);
        }
      } catch {
        /* Formular bleibt ohne Kalkulator nutzbar */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config.slug]);

  const partyCount = Number.parseInt(partySize, 10);
  const partyForEstimate =
    Number.isFinite(partyCount) && partyCount > 0 ? partyCount : 0;
  const selectedMenu = menus.find((menu) => menu.id === menuSelection.menuId) ?? null;
  const selectedPackageIds = selectedEventInquiryPackageIds(
    selectedMenu
      ? { ...packageSelection, buffetId: null }
      : packageSelection,
  );
  const packageEstimate = eventPackageEstimateTotal(
    packages.filter((pkg) => selectedPackageIds.includes(pkg.id)),
    partyForEstimate,
  );
  const menuEstimate = selectedMenu
    ? eventMenuEstimateTotal(selectedMenu, menuSelection, partyForEstimate)
    : 0;
  const estimateTotal = Math.round((packageEstimate + menuEstimate) * 100) / 100;
  const resizeDeps = [
    success,
    packages.length,
    menus.length,
    selectedPackageIds.join("|"),
    menuSelection.menuId,
    JSON.stringify(menuSelection.courseCounts),
    JSON.stringify(menuSelection.addonCounts),
    JSON.stringify(menuSelection.wishes),
    partySize,
  ];

  useEffect(() => {
    setMenuSelection((prev) =>
      selectionWithMenu(menus, prev.menuId, partyForEstimate, prev.wishes, prev),
    );
  }, [menus, partyForEstimate]);

  const onSubmit = async () => {
    setFormError(null);
    const nextErrors: FieldErrors = {};
    if (!dateYmd) nextErrors.date = true;
    if (!/^\d{2}:\d{2}$/.test(timeHm)) nextErrors.time = true;
    const party = Number.parseInt(partySize, 10);
    if (
      !Number.isFinite(party) ||
      party < 1 ||
      party > RESERVATION_PARTY_SIZE_MAX_STAFF
    ) {
      nextErrors.party = true;
    }
    if (!normalizeReservationGuestLastName(lastName)) nextErrors.lastName = true;
    if (!hasGuestContactFilled(phoneCountryIso, phoneLocal, email, countries)) {
      nextErrors.contact = true;
    }
    const emailOn = notifyEmail && hasEmail;
    const waOn = notifyWhatsapp && hasPhone;
    if (!emailOn && !waOn) nextErrors.notifyChannel = true;
    if (!termsAccepted) nextErrors.terms = true;
    if (
      Number.isFinite(party) &&
      selectedMenu &&
      findEventMenuCourseIssues(selectedMenu, menuSelection, party).length > 0
    ) {
      nextErrors.menu = true;
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError(t("checkFields"));
      return;
    }

    const startsAt = ymdHmToRestaurantIso(dateYmd, timeHm, config.timezone);
    setPhase("loading");
    try {
      const res = await fetch("/api/public/event-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: config.slug,
          guest_first_name: normalizeReservationGuestFirstName(firstName),
          guest_last_name: normalizeReservationGuestLastName(lastName),
          guest_company: normalizeReservationGuestCompany(company),
          guest_phone: formatGuestPhone(phoneCountryIso, phoneLocal, countries),
          guest_email: email.trim() || null,
          party_size: party,
          starts_at: startsAt,
          occasion: occasion.trim() || null,
          message: message.trim() || null,
          notify_email: emailOn,
          notify_whatsapp: waOn,
          terms_accepted: true,
          website,
          package_ids: selectedPackageIds,
          menu_id: menuSelection.menuId,
          menu_selection: menuSelection.menuId
            ? {
                wishes: menuSelection.wishes,
                course_counts: menuSelection.courseCounts,
                addon_counts: menuSelection.addonCounts,
              }
            : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(errorMessage(data.error));
        setPhase("idle");
        return;
      }
      setSuccess(true);
      setPhase("idle");
    } catch {
      setFormError(tr("networkError"));
      setPhase("idle");
    }
  };

  if (success) {
    return (
      <EmbedAccentRoot
        accentHex={config.accentHex}
        textTheme={textTheme}
        brandFooter={!profileSheet}
        sourceLocale={sourceLocale}
        showLocalePicker={!profileSheet}
      >
        {profileSheet ? null : (
          <EmbedResizeReporter deps={resizeDeps} widget="event_inquiry" />
        )}
        <div
          className={
            profileSheet ? "px-0 py-6 text-center" : "px-4 py-10 text-center"
          }
        >
          <h1 className="text-lg font-semibold tracking-tight" data-embed-mt>
            {t("successTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground" data-embed-mt>
            {t("successHint")}
          </p>
        </div>
      </EmbedAccentRoot>
    );
  }

  return (
    <EmbedAccentRoot
      accentHex={config.accentHex}
      textTheme={textTheme}
      brandFooter={!profileSheet}
      sourceLocale={sourceLocale}
      showLocalePicker={!profileSheet}
    >
      {profileSheet ? null : (
        <EmbedResizeReporter deps={resizeDeps} widget="event_inquiry" />
      )}
      <div
        className={
          profileSheet ? "space-y-4 px-0 py-0" : "space-y-4 px-4 py-5 sm:px-6"
        }
      >
        <div className="space-y-1">
          {profileSheet ? null : (
            <h1 className="text-lg font-semibold tracking-tight" data-embed-mt>
              {t("title")}
            </h1>
          )}
          <p className="text-sm text-muted-foreground" data-embed-mt>
            {t("intro", { restaurant: config.name })}
          </p>
        </div>

        <div className="grid w-full min-w-0 gap-3 sm:grid-cols-3">
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs sm:text-sm">{tr("date")}</Label>
            <DatePickerField
              value={dateYmd}
              onChange={(v) => {
                setDateYmd(v ?? "");
                clearFieldError("date");
              }}
              fullWidth
            />
            {fieldErrors.date ? (
              <p className="text-xs text-destructive">{hint("date")}</p>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="event-inquiry-time" className="text-xs sm:text-sm">
              {tr("time")}
            </Label>
            <Input
              id="event-inquiry-time"
              type="time"
              value={timeHm}
              onChange={(e) => {
                setTimeHm(e.target.value);
                clearFieldError("time");
              }}
              aria-invalid={fieldErrors.time || undefined}
              className={formScheduleTimeInputClassName}
            />
            {fieldErrors.time ? (
              <p className="text-xs text-destructive">{hint("time")}</p>
            ) : null}
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="event-inquiry-party" className="text-xs sm:text-sm">
              {tr("persons")}
            </Label>
            <Input
              id="event-inquiry-party"
              type="number"
              min={1}
              max={RESERVATION_PARTY_SIZE_MAX_STAFF}
              value={partySize}
              onChange={(e) => {
                setPartySize(e.target.value);
                clearFieldError("party");
              }}
              aria-invalid={fieldErrors.party || undefined}
              className="h-10 rounded-xl"
            />
            {fieldErrors.party ? (
              <p className="text-xs text-destructive">{hint("party")}</p>
            ) : null}
          </div>
        </div>

        <EmbedEventInquiryMenus
          menus={menus}
          partySize={partyForEstimate}
          selection={menuSelection}
          onSelectionChange={(next) => {
            setMenuSelection(next);
            clearFieldError("menu");
            if (next.menuId) {
              setPackageSelection((prev) => ({ ...prev, buffetId: null }));
            }
          }}
          labels={{
            title: t("menusTitle"),
            hint: t("menusHint"),
            none: t("menusNone"),
            perPerson: (price) => t("packagesPerPerson", { price }),
            kidsPrice: (price) => t("menusKidsPrice", { price }),
            partyRange: (range) => range,
            tooFew: (min) => t("menusTooFew", { min }),
            tooMany: (max) => t("menusTooMany", { max }),
            wishesTitle: t("wishesTitle"),
            wishesHint: t("wishesHint"),
            diet: {
              vegetarian: t("dietVegetarian"),
              vegan: t("dietVegan"),
              gluten_free: t("dietGlutenFree"),
              lactose_free: t("dietLactoseFree"),
              no_pork: t("dietNoPork"),
              kids: t("dietKids"),
            },
            coursesTitle: t("coursesTitle"),
            included: t("coursesIncluded"),
            assigned: (assigned, expected) =>
              t("coursesAssigned", { assigned, expected }),
            extraPrice: (price) => t("coursesExtra", { price }),
            addonsTitle: t("menuAddonsTitle"),
            addonPerPerson: t("addonPerPerson"),
            addonFlat: t("addonFlat"),
            addonExcludeKids: t("addonExcludeKids"),
            wishWarning: (diet) => t("wishWarning", { diet }),
          }}
        />
        {fieldErrors.menu ? (
          <p className="text-xs text-destructive">{hint("menu")}</p>
        ) : null}

        <EmbedEventInquiryPackages
          packages={packages}
          selection={packageSelection}
          hideBuffet={Boolean(menuSelection.menuId)}
          showEstimate={menus.length === 0}
          onSelectionChange={setPackageSelection}
          labels={{
            title: t("packagesTitle"),
            hint: t("packagesHint"),
            buffet: t("packagesBuffet"),
            drinks: t("packagesDrinks"),
            extra: t("packagesExtra"),
            noneBuffet: t("packagesNoneBuffet"),
            noneDrinks: t("packagesNoneDrinks"),
            perPerson: (price) => t("packagesPerPerson", { price }),
            estimate: t("packagesEstimate", {
              total: formatMenuPrice(estimateTotal),
              count: partyForEstimate,
            }),
            estimateHint: t("packagesEstimateHint"),
            noneSelected: t("packagesNoneSelected"),
          }}
        />

        {menus.length > 0 ? (
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
            {estimateTotal > 0 ? (
              <>
                <p className="text-sm font-medium" data-embed-mt>
                  {t("packagesEstimate", {
                    total: formatMenuPrice(estimateTotal),
                    count: partyForEstimate,
                  })}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground" data-embed-mt>
                  {t("packagesEstimateHint")}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground" data-embed-mt>
                {t("packagesNoneSelected")}
              </p>
            )}
          </div>
        ) : null}

        <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="event-inquiry-last">{tr("lastName")}</Label>
            <Input
              id="event-inquiry-last"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                clearFieldError("lastName");
              }}
              autoComplete="family-name"
              aria-invalid={fieldErrors.lastName || undefined}
              className="h-10 rounded-xl"
            />
            {fieldErrors.lastName ? (
              <p className="text-xs text-destructive">{hint("lastName")}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-inquiry-first">{tr("firstName")}</Label>
            <Input
              id="event-inquiry-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              className="h-10 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event-inquiry-company">{t("company")}</Label>
          <Input
            id="event-inquiry-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            maxLength={200}
            className="h-10 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event-inquiry-occasion">{t("occasion")}</Label>
          <Input
            id="event-inquiry-occasion"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder={t("occasionPlaceholder")}
            maxLength={120}
            className="h-10 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event-inquiry-message">{t("message")}</Label>
          <Textarea
            id="event-inquiry-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={t("messagePlaceholder")}
            className="min-h-[4.5rem] resize-y rounded-xl"
          />
        </div>

        <div className="w-full min-w-0 space-y-3">
          <div className="space-y-1.5">
            <Label>{tr("phone")}</Label>
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
            <Label htmlFor="event-inquiry-email">{tr("email")}</Label>
            <Input
              id="event-inquiry-email"
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
          {fieldErrors.contact ? (
            <p className="text-xs text-destructive">{hint("contact")}</p>
          ) : null}
        </div>

        <div className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
          <div className={cn("flex items-center justify-between gap-3 py-0.5", !hasEmail && "opacity-50")}>
            <span
              id="event-inquiry-notify-email"
              className="flex min-w-0 items-center gap-2.5 text-sm leading-snug"
            >
              <Mail className={reservationNotifyRowMailIconClassName} aria-hidden />
              {tr("notifyEmail")}
            </span>
            <Switch
              checked={notifyEmail}
              disabled={!hasEmail}
              onCheckedChange={(v) => {
                setNotifyEmail(v === true);
                if (v === true) clearFieldError("notifyChannel");
              }}
              size="sm"
              aria-labelledby="event-inquiry-notify-email"
            />
          </div>
          <div className={cn("flex items-center justify-between gap-3 py-0.5", !hasPhone && "opacity-50")}>
            <span
              id="event-inquiry-notify-wa"
              className="flex min-w-0 items-center gap-2.5 text-sm leading-snug"
            >
              <WhatsAppGlyph
                className={reservationNotifyRowWhatsAppIconClassName}
                aria-hidden
              />
              {tr("notifyWhatsapp")}
            </span>
            <Switch
              checked={notifyWhatsapp}
              disabled={!hasPhone}
              onCheckedChange={(v) => {
                setNotifyWhatsapp(v === true);
                if (v === true) clearFieldError("notifyChannel");
              }}
              size="sm"
              aria-labelledby="event-inquiry-notify-wa"
            />
          </div>
          {fieldErrors.notifyChannel ? (
            <p className="text-xs text-destructive">{hint("notifyChannel")}</p>
          ) : null}
        </div>

        <div className="flex items-start gap-3">
          <Switch
            checked={termsAccepted}
            onCheckedChange={(v) => {
              setTermsAccepted(v === true);
              if (v === true) clearFieldError("terms");
            }}
            size="sm"
            aria-labelledby="event-inquiry-terms"
          />
          <button
            type="button"
            id="event-inquiry-terms"
            className="flex min-w-0 items-center gap-2 text-left text-sm leading-snug underline-offset-2 hover:underline"
            onClick={() => scheduleTermsSheetOpen(setTermsSheetOpen)}
          >
            <TermsGlyph className={reservationNotifyRowTermsIconClassName} aria-hidden />
            <span data-embed-mt>{t("termsAccept")}</span>
          </button>
        </div>
        {fieldErrors.terms ? (
          <p className="text-xs text-destructive">{hint("terms")}</p>
        ) : null}

        <div className="hidden" aria-hidden>
          <Input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {formError ? (
          <p className="text-sm text-destructive">{formError}</p>
        ) : null}

        <EmbedSubmitButton
          phase={phase}
          idleLabel={t("submit")}
          onClick={() => void onSubmit()}
        />

        {footerText ? (
          <p className="text-xs text-muted-foreground" data-embed-mt>
            {footerText}
          </p>
        ) : null}
      </div>

      {renderTermsSheetInsideWidget ? (
        <EmbedReservationTermsSheet
          open={termsSheetOpen}
          onOpenChange={setTermsSheetOpen}
          restaurantName={config.name}
        />
      ) : null}
    </EmbedAccentRoot>
  );
}
