"use client";

import { toast } from "sonner";
import type { DispatchEvent } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { reservationDispatchWarningMessage } from "@/lib/reservations/reservation-guest-notify-dispatch-summary";
import { triggerReservationEmailDispatch } from "@/lib/reservations/trigger-email-dispatch";
import {
  triggerReservationWhatsappDispatch,
  type WhatsappDispatchApiResult,
} from "@/lib/reservations/trigger-whatsapp-dispatch";

export type ReservationGuestNotifyDispatchParams = {
  reservationId: string;
  dispatchEvent: DispatchEvent;
  notifyWhatsapp: boolean;
  notifyEmail: boolean;
  isSuperadmin?: boolean;
  guestNotifyMessage?: string | null;
  onWhatsappDispatched?: (result: WhatsappDispatchApiResult) => void;
};

/** Gast-Benachrichtigung im Hintergrund — kein Blockieren von Toasts/UI. */
export function dispatchReservationGuestNotificationsInBackground(
  params: ReservationGuestNotifyDispatchParams,
): void {
  void (async () => {
    const dispatchOpts = params.guestNotifyMessage?.trim()
      ? { guestNotifyMessage: params.guestNotifyMessage.trim() }
      : undefined;

    const [whatsappResult, emailResult] = await Promise.all([
      params.notifyWhatsapp
        ? triggerReservationWhatsappDispatch(
            params.reservationId,
            params.dispatchEvent,
            dispatchOpts,
          )
        : Promise.resolve(null),
      params.notifyEmail
        ? triggerReservationEmailDispatch(
            params.reservationId,
            params.dispatchEvent,
            dispatchOpts,
          )
        : Promise.resolve(null),
    ]);

    if (whatsappResult?.ok && whatsappResult.messageBody?.trim()) {
      params.onWhatsappDispatched?.(whatsappResult);
    }

    const waWarn = reservationDispatchWarningMessage(
      "whatsapp",
      whatsappResult,
    );
    if (waWarn) toast.warning(waWarn);

    const emWarn = reservationDispatchWarningMessage("email", emailResult, {
      isSuperadmin: params.isSuperadmin,
    });
    if (emWarn) toast.warning(emWarn);
  })();
}
