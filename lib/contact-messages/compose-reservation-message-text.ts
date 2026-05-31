import type { ReservationMessageContext } from "@/lib/whatsapp/reservation-message-templates";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Kurzinfo zur Reservierung, die vor der freien Nachricht mitversendet wird. */
export function composeReservationContextBlock(
  ctx: ReservationMessageContext,
): string {
  const guest = [ctx.guestFirstName, ctx.guestLastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
  const lines = [
    ctx.restaurantName?.trim()
      ? `Reservierung bei ${ctx.restaurantName.trim()}`
      : "Ihre Reservierung",
    `#${ctx.reservationNumber} · ${ctx.partySize} Pers.`,
    whenFmt.format(ctx.startsAt),
    guest ? `Gast: ${guest}` : null,
    ctx.manageUrl?.trim() ? `Verwalten: ${ctx.manageUrl.trim()}` : null,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

export function composeOutboundWithReservationContext(
  ctx: ReservationMessageContext,
  customBody: string,
): string {
  const custom = customBody.trim();
  const block = composeReservationContextBlock(ctx);
  if (!custom) return block;
  return `${block}\n\n---\n\n${custom}`;
}
