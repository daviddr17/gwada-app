import "server-only";

import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { wahaCheckNumberExists, wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchDisplayReservationForMessage(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
): Promise<
  | {
      id: string;
      contact_id: string | null;
      guest_phone: string | null;
      guest_email: string | null;
      guest_first_name: string;
      guest_last_name: string;
      reservation_number: number;
    }
  | null
> {
  const { data } = await admin
    .from("reservations")
    .select(
      "id, restaurant_id, contact_id, guest_phone, guest_email, guest_first_name, guest_last_name, reservation_number",
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!data || data.restaurant_id !== restaurantId) return null;
  return data as {
    id: string;
    contact_id: string | null;
    guest_phone: string | null;
    guest_email: string | null;
    guest_first_name: string;
    guest_last_name: string;
    reservation_number: number;
  };
}

export async function checkDisplayReservationWhatsappNumber(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
): Promise<
  | { ok: true; exists: boolean; chatId: string | null }
  | { ok: false; error: string }
> {
  const row = await fetchDisplayReservationForMessage(
    admin,
    restaurantId,
    reservationId,
  );
  if (!row) return { ok: false, error: "not_found" };

  const phone = row.guest_phone?.trim();
  if (!phone) return { ok: false, error: "no_phone" };

  const config = await getWahaServerConfigAdmin();
  if (!config) return { ok: false, error: "waha_not_configured" };

  const session = wahaSessionNameForRestaurant(restaurantId);
  const sessionRes = await wahaGetSession(config, session);
  if (!sessionRes.ok || sessionRes.data?.status !== "WORKING") {
    return { ok: false, error: "whatsapp_not_connected" };
  }

  const digits = phone.replace(/\D/g, "");
  const check = await wahaCheckNumberExists(config, session, digits);
  if (!check.ok) {
    return { ok: false, error: check.error };
  }

  const chatId =
    check.data.chatId ??
    guestPhoneToWhatsAppChatId(phone) ??
    null;

  return {
    ok: true,
    exists: Boolean(check.data.numberExists),
    chatId,
  };
}

export async function sendDisplayReservationMessage(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    reservationId: string;
    messageBody: string;
    sendWhatsapp: boolean;
    sendEmail: boolean;
    sentByProfileId: string | null;
    /** Anzeigename im Nachrichten-Protokoll, z. B. „Max · Display“. */
    sentByLabel?: string | null;
    restaurantName?: string | null;
  },
): Promise<{ ok: boolean; errors?: string[] }> {
  const row = await fetchDisplayReservationForMessage(
    admin,
    params.restaurantId,
    params.reservationId,
  );
  if (!row) return { ok: false, errors: ["not_found"] };

  if (!row.contact_id) {
    return { ok: false, errors: ["no_contact"] };
  }

  const hasPhone = Boolean(row.guest_phone?.trim());
  const hasEmail = Boolean(row.guest_email?.trim()?.includes("@"));

  if (params.sendWhatsapp && !hasPhone) {
    return { ok: false, errors: ["whatsapp:no_phone"] };
  }
  if (params.sendEmail && !hasEmail) {
    return { ok: false, errors: ["email:no_email"] };
  }

  if (params.sendWhatsapp) {
    const waCheck = await checkDisplayReservationWhatsappNumber(
      admin,
      params.restaurantId,
      params.reservationId,
    );
    if (!waCheck.ok) {
      return { ok: false, errors: [`whatsapp:${waCheck.error}`] };
    }
    if (!waCheck.exists) {
      return { ok: false, errors: ["whatsapp:number_not_registered"] };
    }
  }

  const channels: ("gwada" | "whatsapp" | "email")[] = ["gwada"];
  if (params.sendWhatsapp) channels.push("whatsapp");
  if (params.sendEmail) channels.push("email");

  return sendContactMessageServer(admin, {
    restaurantId: params.restaurantId,
    contactId: row.contact_id,
    body: params.messageBody,
    direction: "outbound",
    channels,
    reservationId: params.reservationId,
    sentBy: params.sentByProfileId,
    sentByLabel: params.sentByLabel ?? null,
    restaurantName: params.restaurantName,
  });
}
