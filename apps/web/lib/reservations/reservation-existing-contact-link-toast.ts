import { toast } from "sonner";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import {
  contactDisplayName,
  fetchContactById,
  findContactByEmailNormalized,
  findContactByPhoneNormalized,
} from "@/lib/supabase/contacts-db";

export type ReservationExistingContactLinkContext = {
  restaurantId: string;
  previousContactId: string | null;
  savedContactId: string | null;
  /** Kontakt manuell aus Kontakte-Modul gewählt — kein Auto-Link-Hinweis. */
  manualInitialContactId?: string | null;
};

/** Kontakt, der vor dem Speichern bereits zu Telefon/E-Mail passte (Trigger würde verknüpfen). */
export async function resolveExistingContactBeforeReservationLink(params: {
  restaurantId: string;
  guestPhone: string | null;
  guestEmail: string | null;
}): Promise<{ contactId: string; displayName: string } | null> {
  const phoneNorm = params.guestPhone
    ? normalizeContactPhone(params.guestPhone)
    : null;
  const emailNorm = params.guestEmail
    ? normalizeContactEmail(params.guestEmail)
    : null;

  let phoneMatch: { contactId: string; displayName: string } | null = null;
  let emailMatch: { contactId: string; displayName: string } | null = null;

  if (phoneNorm) {
    phoneMatch = await findContactByPhoneNormalized({
      restaurantId: params.restaurantId,
      phoneNormalized: phoneNorm,
    });
  }
  if (emailNorm) {
    emailMatch = await findContactByEmailNormalized({
      restaurantId: params.restaurantId,
      emailNormalized: emailNorm,
    });
  }

  if (
    phoneMatch &&
    emailMatch &&
    phoneMatch.contactId !== emailMatch.contactId
  ) {
    return null;
  }

  return phoneMatch ?? emailMatch;
}

export function shouldNotifyExistingContactLink(
  ctx: ReservationExistingContactLinkContext,
  existingBeforeSave: { contactId: string } | null,
): boolean {
  if (!ctx.savedContactId) return false;
  if (
    ctx.manualInitialContactId &&
    ctx.manualInitialContactId === ctx.savedContactId
  ) {
    return false;
  }
  if (ctx.previousContactId) return false;
  if (!existingBeforeSave) return false;
  return existingBeforeSave.contactId === ctx.savedContactId;
}

export function showExistingContactLinkToast(displayName: string) {
  toast.info(`Mit bestehendem Kontakt „${displayName}" verknüpft`, {
    duration: 4_000,
  });
}

export async function maybeShowReservationExistingContactLinkToast(
  ctx: ReservationExistingContactLinkContext,
  existingBeforeSave: { contactId: string; displayName: string } | null,
): Promise<void> {
  if (!shouldNotifyExistingContactLink(ctx, existingBeforeSave)) return;

  let displayName = existingBeforeSave?.displayName?.trim();
  if (!displayName && ctx.savedContactId) {
    const { data } = await fetchContactById({
      restaurantId: ctx.restaurantId,
      contactId: ctx.savedContactId,
    });
    if (data) displayName = contactDisplayName(data);
  }
  if (!displayName) return;

  showExistingContactLinkToast(displayName);
}
