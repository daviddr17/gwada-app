import { fetchReservationForWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Telefon für WhatsApp-Versand: Reservierungs-Gastnummer, sonst primäre Kontakt-Nummer. */
export async function resolveWhatsappPhoneForContact(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    reservationId?: string | null;
  },
): Promise<string | null> {
  if (params.reservationId) {
    const row = await fetchReservationForWhatsapp(admin, params.reservationId);
    const guest = row?.guest_phone?.trim();
    if (guest) return guest;
  }

  const { data: phones } = await admin
    .from("contact_phones")
    .select("phone_display, is_primary, sort_order")
    .eq("contact_id", params.contactId)
    .eq("restaurant_id", params.restaurantId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });

  const sorted = [...(phones ?? [])].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) ||
      (a.sort_order as number) - (b.sort_order as number),
  );
  for (const p of sorted) {
    const display = (p as { phone_display: string }).phone_display?.trim();
    if (display) return display;
  }
  return null;
}
