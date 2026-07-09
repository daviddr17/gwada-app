import "server-only";

import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import { resolveContactIdByWhatsappChat } from "@/lib/contacts/resolve-contact-by-whatsapp-chat";
import { fetchRestaurantContactSettingsAdmin } from "@/lib/contacts/contact-settings-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactIdentityEventType = "reservation" | "message" | "review";

export type ContactIdentityCandidate = {
  contactId: string;
  matchedBy: Array<"email" | "phone" | "whatsapp">;
};

export type ContactIdentityResolution =
  | { action: "link"; contactId: string }
  | { action: "create"; contactId: string }
  | { action: "ambiguous"; candidates: ContactIdentityCandidate[] }
  | {
      action: "skip";
      reason: "master_disabled" | "no_identity" | "auto_create_disabled";
    };

export type ResolveContactIdentityParams = {
  restaurantId: string;
  eventType: ContactIdentityEventType;
  email?: string | null;
  phone?: string | null;
  phoneDisplay?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  whatsappChatId?: string | null;
  /** Nur verknüpfen, nie anlegen (z. B. Anreicherung). */
  linkOnly?: boolean;
};

async function findContactIdByEmailNormalized(
  admin: SupabaseClient,
  restaurantId: string,
  emailNormalized: string,
): Promise<string | null> {
  const { data } = await admin
    .from("contact_emails")
    .select("contact_id")
    .eq("restaurant_id", restaurantId)
    .eq("email_normalized", emailNormalized)
    .limit(1)
    .maybeSingle();
  return (data?.contact_id as string | undefined) ?? null;
}

async function findContactIdByPhoneNormalized(
  admin: SupabaseClient,
  restaurantId: string,
  phoneNormalized: string,
): Promise<string | null> {
  const { data } = await admin
    .from("contact_phones")
    .select("contact_id")
    .eq("restaurant_id", restaurantId)
    .eq("phone_normalized", phoneNormalized)
    .limit(1)
    .maybeSingle();
  return (data?.contact_id as string | undefined) ?? null;
}

function splitPersonName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Gast", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

function firstNameFromEmail(emailNormalized: string): string {
  const local = emailNormalized.split("@")[0]?.trim() ?? "";
  if (!local || local.length < 2) return "Gast";
  return local.slice(0, 80);
}

function autoCreateEnabledForEvent(
  settings: Awaited<ReturnType<typeof fetchRestaurantContactSettingsAdmin>>,
  eventType: ContactIdentityEventType,
): boolean {
  switch (eventType) {
    case "reservation":
      return settings.autoCreateFromReservations;
    case "message":
      return settings.autoCreateFromMessages;
    case "review":
      return settings.autoCreateFromReviews;
  }
}

function collectIdentityCandidates(params: {
  phoneContactId: string | null;
  emailContactId: string | null;
  whatsappContactId: string | null;
}): ContactIdentityCandidate[] {
  const byId = new Map<string, Set<"email" | "phone" | "whatsapp">>();

  const add = (
    contactId: string | null,
    field: "email" | "phone" | "whatsapp",
  ) => {
    if (!contactId) return;
    const set = byId.get(contactId) ?? new Set();
    set.add(field);
    byId.set(contactId, set);
  };

  add(params.phoneContactId, "phone");
  add(params.emailContactId, "email");
  add(params.whatsappContactId, "whatsapp");

  return [...byId.entries()].map(([contactId, matchedBy]) => ({
    contactId,
    matchedBy: [...matchedBy],
  }));
}

async function touchContactRow(
  admin: SupabaseClient,
  contactId: string,
  patch?: { firstName?: string; lastName?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const updates: Record<string, string> = {
    last_interaction_at: now,
    updated_at: now,
  };
  if (patch?.firstName?.trim()) {
    updates.first_name = patch.firstName.trim();
  }
  if (patch?.lastName?.trim()) {
    updates.last_name = patch.lastName.trim();
  }
  await admin.from("contacts").update(updates).eq("id", contactId);
}

async function ensureContactEmail(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    email: string;
    emailNormalized: string;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from("contact_emails")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .eq("email_normalized", params.emailNormalized)
    .maybeSingle();
  if (existing) return;

  const { count } = await admin
    .from("contact_emails")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", params.contactId);

  await admin.from("contact_emails").insert({
    contact_id: params.contactId,
    restaurant_id: params.restaurantId,
    email: params.email.trim(),
    email_normalized: params.emailNormalized,
    is_primary: (count ?? 0) === 0,
  });
}

async function ensureContactPhone(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    phoneDisplay: string;
    phoneNormalized: string;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from("contact_phones")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .eq("phone_normalized", params.phoneNormalized)
    .maybeSingle();
  if (existing) return;

  const { count } = await admin
    .from("contact_phones")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", params.contactId);

  await admin.from("contact_phones").insert({
    contact_id: params.contactId,
    restaurant_id: params.restaurantId,
    phone_display: params.phoneDisplay.trim(),
    phone_normalized: params.phoneNormalized,
    is_primary: (count ?? 0) === 0,
  });
}

async function insertContactWithIdentity(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    emailNormalized: string | null;
    phoneDisplay: string | null;
    phoneNormalized: string | null;
  },
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("contacts")
    .insert({
      restaurant_id: params.restaurantId,
      first_name: params.firstName.trim() || "Gast",
      last_name: params.lastName.trim(),
      last_interaction_at: now,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.warn("[contact-identity] insert contact", error?.message);
    return null;
  }

  const contactId = (data as { id: string }).id;

  if (params.emailNormalized && params.email) {
    const { error: emailErr } = await admin.from("contact_emails").insert({
      contact_id: contactId,
      restaurant_id: params.restaurantId,
      email: params.email.trim(),
      email_normalized: params.emailNormalized,
      is_primary: true,
    });
    if (emailErr) {
      const recovered = await findContactIdByEmailNormalized(
        admin,
        params.restaurantId,
        params.emailNormalized,
      );
      if (recovered) {
        await admin.from("contacts").delete().eq("id", contactId);
        return recovered;
      }
      console.warn("[contact-identity] insert email", emailErr.message);
      return null;
    }
  }

  if (params.phoneNormalized && params.phoneDisplay) {
    const { error: phoneErr } = await admin.from("contact_phones").insert({
      contact_id: contactId,
      restaurant_id: params.restaurantId,
      phone_display: params.phoneDisplay.trim(),
      phone_normalized: params.phoneNormalized,
      is_primary: !params.emailNormalized,
    });
    if (phoneErr) {
      const recovered = await findContactIdByPhoneNormalized(
        admin,
        params.restaurantId,
        params.phoneNormalized,
      );
      if (recovered) {
        await admin.from("contacts").delete().eq("id", contactId);
        return recovered;
      }
      console.warn("[contact-identity] insert phone", phoneErr.message);
      return null;
    }
  }

  return contactId;
}

/**
 * Entscheidet über Verknüpfung, Anlage oder Mehrdeutigkeit — ohne DB-Schreibvorgänge.
 */
export async function resolveContactIdentity(
  admin: SupabaseClient,
  params: ResolveContactIdentityParams,
): Promise<ContactIdentityResolution> {
  const settings = await fetchRestaurantContactSettingsAdmin(
    admin,
    params.restaurantId,
  );

  if (!settings.autoLinkEnabled) {
    return { action: "skip", reason: "master_disabled" };
  }

  const emailNorm = params.email
    ? normalizeContactEmail(params.email)
    : null;
  const phoneNorm = params.phone
    ? normalizeContactPhone(params.phone)
    : params.phoneDisplay
      ? normalizeContactPhone(params.phoneDisplay)
      : null;

  const whatsappChatId = params.whatsappChatId?.trim() || null;

  if (!emailNorm && !phoneNorm && !whatsappChatId) {
    return { action: "skip", reason: "no_identity" };
  }

  const whatsappContactId = whatsappChatId
    ? await resolveContactIdByWhatsappChat(admin, {
        restaurantId: params.restaurantId,
        chatId: whatsappChatId,
      })
    : null;
  const phoneContactId = phoneNorm
    ? await findContactIdByPhoneNormalized(
        admin,
        params.restaurantId,
        phoneNorm,
      )
    : null;
  const emailContactId = emailNorm
    ? await findContactIdByEmailNormalized(
        admin,
        params.restaurantId,
        emailNorm,
      )
    : null;

  const candidates = collectIdentityCandidates({
    phoneContactId,
    emailContactId,
    whatsappContactId,
  });

  if (candidates.length > 1) {
    console.warn("[contact-identity] ambiguous match", {
      restaurantId: params.restaurantId,
      eventType: params.eventType,
      candidates,
    });
    return { action: "ambiguous", candidates };
  }

  if (candidates.length === 1) {
    return { action: "link", contactId: candidates[0]!.contactId };
  }

  if (params.linkOnly) {
    return { action: "skip", reason: "auto_create_disabled" };
  }

  if (!autoCreateEnabledForEvent(settings, params.eventType)) {
    return { action: "skip", reason: "auto_create_disabled" };
  }

  const firstName =
    params.firstName?.trim() ||
    (emailNorm ? firstNameFromEmail(emailNorm) : "Gast");
  const lastName = params.lastName?.trim() ?? "";
  const phoneDisplay =
    params.phoneDisplay?.trim() ||
    params.phone?.trim() ||
    (phoneNorm ? `+${phoneNorm}` : null);

  const contactId = await insertContactWithIdentity(admin, {
    restaurantId: params.restaurantId,
    firstName,
    lastName,
    email: params.email?.trim() || null,
    emailNormalized: emailNorm,
    phoneDisplay,
    phoneNormalized: phoneNorm,
  });

  if (!contactId) {
    return { action: "skip", reason: "auto_create_disabled" };
  }

  return { action: "create", contactId };
}

/**
 * Auflösung inkl. Touch und fehlender E-Mail/Telefon am bestehenden Kontakt.
 */
export async function executeContactIdentityResolution(
  admin: SupabaseClient,
  params: ResolveContactIdentityParams,
): Promise<{ contactId: string | null; resolution: ContactIdentityResolution }> {
  const resolution = await resolveContactIdentity(admin, params);

  const emailNorm = params.email
    ? normalizeContactEmail(params.email)
    : null;
  const phoneNorm = params.phone
    ? normalizeContactPhone(params.phone)
    : params.phoneDisplay
      ? normalizeContactPhone(params.phoneDisplay)
      : null;
  const phoneDisplay =
    params.phoneDisplay?.trim() ||
    params.phone?.trim() ||
    (phoneNorm ? `+${phoneNorm}` : null);

  const namePatch =
    params.firstName?.trim() || params.lastName?.trim()
      ? {
          firstName: params.firstName?.trim(),
          lastName: params.lastName?.trim(),
        }
      : undefined;

  if (resolution.action === "link") {
    await touchContactRow(admin, resolution.contactId, namePatch);
    if (emailNorm && params.email) {
      await ensureContactEmail(admin, {
        restaurantId: params.restaurantId,
        contactId: resolution.contactId,
        email: params.email,
        emailNormalized: emailNorm,
      });
    }
    if (phoneNorm && phoneDisplay) {
      await ensureContactPhone(admin, {
        restaurantId: params.restaurantId,
        contactId: resolution.contactId,
        phoneDisplay,
        phoneNormalized: phoneNorm,
      });
    }
    return { contactId: resolution.contactId, resolution };
  }

  if (resolution.action === "create") {
    return { contactId: resolution.contactId, resolution };
  }

  return { contactId: null, resolution };
}

/** Nur bestehenden Kontakt per E-Mail/Telefon/WhatsApp finden — ohne Anlage. */
export async function resolveContactIdByGuestIdentity(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    guestPhone?: string | null;
    guestEmail?: string | null;
    whatsappChatId?: string | null;
  },
): Promise<string | null> {
  const { contactId } = await executeContactIdentityResolution(admin, {
    restaurantId: params.restaurantId,
    eventType: "reservation",
    phone: params.guestPhone,
    email: params.guestEmail,
    whatsappChatId: params.whatsappChatId,
    linkOnly: true,
  });
  return contactId;
}

export {
  findContactIdByEmailNormalized,
  findContactIdByPhoneNormalized,
  touchContactRow,
  ensureContactEmail,
  ensureContactPhone,
  insertContactWithIdentity,
  splitPersonName,
};
