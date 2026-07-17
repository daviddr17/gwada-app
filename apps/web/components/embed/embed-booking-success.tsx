"use client";

import { useLocale, useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { APP_LOCALE_TO_PROFILE, normalizeAppLocale } from "@/i18n/config";
import {
  formatReservationTimeInRestaurantTz,
  DEFAULT_RESTAURANT_TIMEZONE,
} from "@/lib/restaurant/restaurant-timezone";

export type EmbedBookingSuccessDetails = {
  reservation_number: number;
  guest_pin: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
};

function formatSlotForLocale(
  iso: string,
  timeZone: string,
  locale: string,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function EmbedBookingSuccess({
  details,
  changeRequest,
  timeZone = DEFAULT_RESTAURANT_TIMEZONE,
}: {
  details: EmbedBookingSuccessDetails;
  changeRequest?: boolean;
  timeZone?: string;
}) {
  const t = useTranslations("Embed.reservation");
  const appLocale = normalizeAppLocale(useLocale());
  const intlLocale = APP_LOCALE_TO_PROFILE[appLocale] ?? "de-DE";
  const guest =
    `${details.guest_first_name} ${details.guest_last_name}`.trim();
  const slot = formatSlotForLocale(details.starts_at, timeZone, intlLocale);
  const endHm = formatReservationTimeInRestaurantTz(details.ends_at, timeZone);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4"
    >
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          {changeRequest ? t("changeRequestTitle") : t("successTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {changeRequest ? t("changeRequestHint") : t("successHint")}
        </p>
      </div>

      <dl className="grid gap-2 rounded-xl border border-border/40 bg-card/80 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("reservationNumber")}</dt>
          <dd className="font-mono font-semibold tabular-nums">
            #{details.reservation_number}
          </dd>
        </div>
        {changeRequest ? (
          <p className="text-xs text-muted-foreground">{t("pinUnchanged")}</p>
        ) : (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("pin")}</dt>
            <dd className="font-mono font-semibold tracking-widest">
              {details.guest_pin}
            </dd>
          </div>
        )}
        <div className="border-t border-border/40 pt-2">
          <dt className="sr-only">Overview</dt>
          <dd className="space-y-1">
            <p className="font-medium">{guest}</p>
            <p className="text-muted-foreground">
              {details.party_size}{" "}
              {details.party_size === 1 ? t("person") : t("persons")} · {slot}{" "}
              – {endHm}
            </p>
            {details.guest_phone ? (
              <p className="text-muted-foreground">{details.guest_phone}</p>
            ) : null}
            {details.guest_email ? (
              <p className="truncate text-muted-foreground">
                {details.guest_email}
              </p>
            ) : null}
          </dd>
        </div>
      </dl>
    </motion.div>
  );
}
