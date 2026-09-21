import {
  emailAddressFromPseudoContactId,
  isEmailPseudoContactId,
} from "@/lib/contact-messages/email-pseudo-contact";
import {
  digitsFromWhatsAppChatId,
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import { staffDisplayName } from "@/lib/types/staff";
import type { RestaurantStaffRow } from "@/lib/types/staff";

export type InboxThreadStaffMatch = {
  staffId: string;
  staffName: string;
};

export type InboxStaffIdentityIndex = {
  byPhoneDigits: Map<string, InboxThreadStaffMatch>;
  byEmail: Map<string, InboxThreadStaffMatch>;
};

function phoneDigitsForStaffMatch(
  phone: string | null | undefined,
): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function emailForStaffMatch(email: string | null | undefined): string | null {
  return normalizeContactEmail(email);
}

export function buildInboxStaffIdentityIndex(
  staff: readonly Pick<
    RestaurantStaffRow,
    "id" | "given_name" | "family_name" | "phone" | "email" | "is_active"
  >[],
): InboxStaffIdentityIndex {
  const byPhoneDigits = new Map<string, InboxThreadStaffMatch>();
  const byEmail = new Map<string, InboxThreadStaffMatch>();

  for (const row of staff) {
    if (!row.is_active) continue;
    const match: InboxThreadStaffMatch = {
      staffId: row.id,
      staffName: staffDisplayName(row),
    };
    const phoneDigits = phoneDigitsForStaffMatch(row.phone);
    if (phoneDigits && !byPhoneDigits.has(phoneDigits)) {
      byPhoneDigits.set(phoneDigits, match);
    }
    const emailNorm = emailForStaffMatch(row.email);
    if (emailNorm && !byEmail.has(emailNorm)) {
      byEmail.set(emailNorm, match);
    }
  }

  return { byPhoneDigits, byEmail };
}

export function resolveInboxThreadStaffMatch(params: {
  contactId: string;
  staffIndex: InboxStaffIdentityIndex;
  phone?: string | null;
  email?: string | null;
}): InboxThreadStaffMatch | null {
  let phoneDigits: string | null = null;
  let emailNorm: string | null = null;

  if (params.phone?.trim()) {
    phoneDigits = phoneDigitsForStaffMatch(params.phone);
  } else if (isWahaPseudoContactId(params.contactId)) {
    const chatId = wahaChatIdFromPseudoContactId(params.contactId);
    if (chatId) phoneDigits = digitsFromWhatsAppChatId(chatId);
  }

  if (params.email?.trim()) {
    emailNorm = emailForStaffMatch(params.email);
  } else if (isEmailPseudoContactId(params.contactId)) {
    emailNorm = emailAddressFromPseudoContactId(params.contactId);
  }

  if (phoneDigits) {
    const byPhone = params.staffIndex.byPhoneDigits.get(phoneDigits);
    if (byPhone) return byPhone;
  }
  if (emailNorm) {
    return params.staffIndex.byEmail.get(emailNorm) ?? null;
  }
  return null;
}
