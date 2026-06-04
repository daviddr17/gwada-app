import "server-only";

import { syncContactEmailInbox } from "@/lib/contacts/sync-restaurant-email-inbox";
import { syncContactWhatsappInbound } from "@/lib/contacts/sync-contact-whatsapp-inbound";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function syncContactInbox(
  admin: SupabaseClient,
  params: { restaurantId: string; contactId: string },
): Promise<{
  emailImported: number;
  whatsappImported: number;
  errors: string[];
}> {
  const errors: string[] = [];

  const [email, whatsapp] = await Promise.all([
    syncContactEmailInbox(admin, params),
    syncContactWhatsappInbound(admin, params),
  ]);

  if (email.error && email.error !== "no_contact_email") {
    errors.push(`email:${email.error}`);
  }
  if (whatsapp.error && whatsapp.error !== "no_whatsapp_chat") {
    errors.push(`whatsapp:${whatsapp.error}`);
  }

  return {
    emailImported: email.imported,
    whatsappImported: whatsapp.imported,
    errors,
  };
}
