"use client";

import { CopyToClipboardButton } from "@/components/ui/copy-to-clipboard-button";
import { cn } from "@/lib/utils";

type ReservationAccessMetaProps = {
  reservationNumber: number | null | undefined;
  guestPin: string | null | undefined;
  /** Nr. nur voraussichtlich (Neue Reservierung vor Speichern). */
  numberProvisional?: boolean;
  pinPending?: boolean;
  className?: string;
};

export function ReservationAccessMeta({
  reservationNumber,
  guestPin,
  numberProvisional = false,
  pinPending = false,
  className,
}: ReservationAccessMetaProps) {
  const hasNumber =
    reservationNumber != null && Number.isFinite(reservationNumber);
  const hasPin = Boolean(guestPin?.trim() && /^\d{6}$/.test(guestPin.trim()));

  if (!hasNumber && !pinPending && !hasPin) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1 gap-y-1 text-base leading-relaxed",
        className,
      )}
    >
      {hasNumber ? (
        <span className="inline-flex items-center gap-0.5">
          <span>
            Nr.{" "}
            <span className="font-mono font-semibold text-foreground">
              #{reservationNumber}
            </span>
            {numberProvisional ? (
              <span className="text-muted-foreground"> (voraussichtlich)</span>
            ) : null}
          </span>
          <CopyToClipboardButton
            value={String(reservationNumber)}
            label="Reservierungsnummer"
          />
        </span>
      ) : null}

      {hasNumber && (hasPin || pinPending) ? (
        <span className="text-muted-foreground" aria-hidden>
          ·
        </span>
      ) : null}

      {hasPin ? (
        <span className="inline-flex items-center gap-0.5">
          <span>
            PIN{" "}
            <span className="font-mono font-semibold tracking-widest text-foreground">
              {guestPin}
            </span>
          </span>
          <CopyToClipboardButton value={guestPin!.trim()} label="PIN" />
        </span>
      ) : pinPending ? (
        <span className="text-muted-foreground">
          PIN wird beim Speichern automatisch vergeben
        </span>
      ) : null}
    </span>
  );
}
