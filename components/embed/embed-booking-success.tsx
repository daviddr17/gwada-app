"use client";

import { motion } from "framer-motion";
import { formatReservationSlotDe } from "@/lib/reservations/reservation-pending-change";

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

export function EmbedBookingSuccess({
  details,
  changeRequest,
}: {
  details: EmbedBookingSuccessDetails;
  changeRequest?: boolean;
}) {
  const guest =
    `${details.guest_first_name} ${details.guest_last_name}`.trim();
  const slot = formatReservationSlotDe(details.starts_at);
  const endHm = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(details.ends_at));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4"
    >
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          {changeRequest
            ? "Änderungsanfrage eingereicht"
            : "Reservierung erfolgreich abgesendet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {changeRequest
            ? "Das Restaurant prüft deine Wünsche und meldet sich bei Bedarf."
            : "Bitte notiere Reservierungsnummer und PIN für spätere Änderungen."}
        </p>
      </div>

      <dl className="grid gap-2 rounded-xl border border-border/40 bg-card/80 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Reservierungs-Nr.</dt>
          <dd className="font-mono font-semibold tabular-nums">
            #{details.reservation_number}
          </dd>
        </div>
        {changeRequest ? (
          <p className="text-xs text-muted-foreground">
            Deine bestehende PIN bleibt unverändert gültig.
          </p>
        ) : (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">PIN</dt>
            <dd className="font-mono font-semibold tracking-widest">
              {details.guest_pin}
            </dd>
          </div>
        )}
        <div className="border-t border-border/40 pt-2">
          <dt className="sr-only">Übersicht</dt>
          <dd className="space-y-1">
            <p className="font-medium">{guest}</p>
            <p className="text-muted-foreground">
              {details.party_size}{" "}
              {details.party_size === 1 ? "Person" : "Personen"} · {slot} –{" "}
              {endHm}
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
