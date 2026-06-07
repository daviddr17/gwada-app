import "server-only";

import { cookies } from "next/headers";
import {
  GUEST_CHAT_SESSION_COOKIE,
  formatGuestChatSessionCookie,
  guestChatCookieOptions,
  parseGuestChatSessionCookie,
} from "@/lib/contacts/guest-chat-cookies";
import { resolveGuestSessionFromCookie } from "@/lib/contacts/guest-chat-auth-server";
import { fetchGwadaAttachmentsByMessageIds } from "@/lib/contact-messages/gwada-message-attachments-server";
import { syncContactInbox } from "@/lib/contacts/sync-contact-inbox-server";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicContactChatSession = {
  contactId: string;
  restaurantId: string;
  restaurantName: string;
  guestFirstName: string;
};

export type PublicContactMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
  attachments?: ContactMessageAttachment[];
};

async function adminClient(): Promise<SupabaseClient | null> {
  return createSupabaseAdminClient();
}

export async function resolveGuestFromSessionCookie(
  contactId: string,
): Promise<{ contactId: string; restaurantId: string } | null> {
  const admin = await adminClient();
  if (!admin) return null;

  const cookieStore = await cookies();
  const parsed = parseGuestChatSessionCookie(
    cookieStore.get(GUEST_CHAT_SESSION_COOKIE)?.value,
  );
  if (!parsed) return null;

  return resolveGuestSessionFromCookie(admin, {
    contactId,
    sessionId: parsed.sessionId,
    sessionToken: parsed.token,
  });
}

export async function loadPublicContactChatSession(
  contactId: string,
): Promise<
  | { data: PublicContactChatSession; error: null }
  | { data: null; error: string; status: number }
> {
  const session = await resolveGuestFromSessionCookie(contactId);
  if (!session) {
    return { data: null, error: "session_required", status: 401 };
  }

  const admin = await adminClient();
  if (!admin) {
    return { data: null, error: "server_misconfigured", status: 503 };
  }

  const { data: contact } = await admin
    .from("contacts")
    .select("first_name, last_name, restaurant_id, restaurants ( name )")
    .eq("id", session.contactId)
    .maybeSingle();

  if (!contact) {
    return { data: null, error: "not_found", status: 404 };
  }

  const row = contact as {
    first_name: string;
    last_name: string;
    restaurant_id: string;
    restaurants: { name: string } | { name: string }[] | null;
  };
  const restaurants = row.restaurants;
  const restaurantName = Array.isArray(restaurants)
    ? restaurants[0]?.name
    : restaurants?.name;

  return {
    data: {
      contactId: session.contactId,
      restaurantId: session.restaurantId,
      restaurantName: restaurantName?.trim() || "Restaurant",
      guestFirstName: row.first_name?.trim() || "Gast",
    },
    error: null,
  };
}

export function publicGuestAttachmentUrl(params: {
  messageId: string;
  attachmentId: string;
}): string {
  const q = new URLSearchParams({
    messageId: params.messageId,
    attachmentId: params.attachmentId,
  });
  return `/api/public/contact-messages/attachment?${q.toString()}`;
}

export async function loadPublicContactMessages(
  contactId: string,
): Promise<
  | { data: PublicContactMessage[]; error: null }
  | { data: null; error: string; status: number }
> {
  const session = await resolveGuestFromSessionCookie(contactId);
  if (!session) {
    return { data: null, error: "session_required", status: 401 };
  }

  const admin = await adminClient();
  if (!admin) {
    return { data: null, error: "server_misconfigured", status: 503 };
  }

  await syncContactInbox(admin, {
    restaurantId: session.restaurantId,
    contactId: session.contactId,
  });

  const { data: rows, error } = await admin
    .from("contact_messages")
    .select("id, direction, body, created_at")
    .eq("restaurant_id", session.restaurantId)
    .eq("contact_id", session.contactId)
    .eq("platform", "gwada")
    .order("created_at", { ascending: true });

  if (error) {
    return { data: null, error: error.message, status: 500 };
  }

  const messageIds = (rows ?? []).map((r) => (r as { id: string }).id);
  const attachmentsByMessage = await fetchGwadaAttachmentsByMessageIds(
    admin,
    session.restaurantId,
    messageIds,
  );

  const messages: PublicContactMessage[] = (rows ?? []).map((raw) => {
    const r = raw as {
      id: string;
      direction: string;
      body: string;
      created_at: string;
    };
    const attachments = attachmentsByMessage.get(r.id)?.map((a) => ({
      ...a,
      url: publicGuestAttachmentUrl({
        messageId: r.id,
        attachmentId: a.id,
      }),
    }));
    return {
      id: r.id,
      direction: r.direction === "outbound" ? "outbound" : "inbound",
      body: r.body.trim(),
      created_at: r.created_at,
      attachments: attachments?.length ? attachments : undefined,
    };
  });

  return { data: messages, error: null };
}

export async function sendPublicContactMessage(
  contactId: string,
  body: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  const text = body.trim();
  if (!text) {
    return { ok: false, error: "empty_body", status: 400 };
  }

  const session = await resolveGuestFromSessionCookie(contactId);
  if (!session) {
    return { ok: false, error: "session_required", status: 401 };
  }

  const admin = await adminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const { error } = await admin.from("contact_messages").insert({
    restaurant_id: session.restaurantId,
    contact_id: session.contactId,
    platform: "gwada",
    direction: "inbound",
    body: text,
    reservation_id: null,
    sent_by: null,
    delivery_status: "delivered",
  });

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  return { ok: true };
}

export async function loadPublicContactAttachment(
  contactId: string,
  messageId: string,
  attachmentId: string,
): Promise<
  | { fileName: string; mimeType: string; bytes: Buffer }
  | { error: string; status: number }
> {
  const session = await resolveGuestFromSessionCookie(contactId);
  if (!session) {
    return { error: "session_required", status: 401 };
  }

  const admin = await adminClient();
  if (!admin) {
    return { error: "server_misconfigured", status: 503 };
  }

  const { data: msg } = await admin
    .from("contact_messages")
    .select("id")
    .eq("id", messageId)
    .eq("contact_id", session.contactId)
    .eq("restaurant_id", session.restaurantId)
    .eq("platform", "gwada")
    .maybeSingle();

  if (!msg) {
    return { error: "not_found", status: 404 };
  }

  const { data: row } = await admin
    .from("contact_message_attachments")
    .select("file_name, mime_type, storage_path")
    .eq("id", attachmentId)
    .eq("message_id", messageId)
    .eq("restaurant_id", session.restaurantId)
    .maybeSingle();

  if (!row?.storage_path) {
    return { error: "not_found", status: 404 };
  }

  const { data: blob, error: dlError } = await admin.storage
    .from("contact-message-attachments")
    .download(row.storage_path as string);

  if (dlError || !blob) {
    return { error: dlError?.message ?? "download_failed", status: 500 };
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  return {
    fileName: (row.file_name as string) || "anhang",
    mimeType: (row.mime_type as string) || "application/octet-stream",
    bytes: buf,
  };
}

export function setGuestSessionCookie(
  response: Response,
  sessionId: string,
  sessionToken: string,
  expiresAt: string,
): void {
  const maxAge = Math.max(
    60,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  response.headers.append(
    "Set-Cookie",
    `${GUEST_CHAT_SESSION_COOKIE}=${formatGuestChatSessionCookie(sessionId, sessionToken)}; Path=${guestChatCookieOptions.path}; HttpOnly; SameSite=${guestChatCookieOptions.sameSite}; Max-Age=${maxAge}${guestChatCookieOptions.secure ? "; Secure" : ""}`,
  );
}
