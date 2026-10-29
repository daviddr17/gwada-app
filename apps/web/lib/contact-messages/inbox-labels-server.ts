import "server-only";

import {
  wahaCreateLabel,
  wahaGetChatLabels,
  wahaListLabels,
  wahaPutChatLabels,
} from "@/lib/waha/waha-labels";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaChatIdFromPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InboxLabelServerRow = {
  id: string;
  restaurant_id: string;
  name: string;
  background_color: string;
  sort_order: number;
  waha_label_id: string | null;
};

const LABEL_SELECT =
  "id, restaurant_id, name, background_color, sort_order, waha_label_id";

function mapLabel(row: Record<string, unknown>): InboxLabelServerRow {
  return {
    id: row.id as string,
    restaurant_id: row.restaurant_id as string,
    name: row.name as string,
    background_color: (row.background_color as string) || "#64748b",
    sort_order: (row.sort_order as number) ?? 0,
    waha_label_id: (row.waha_label_id as string | null) ?? null,
  };
}

export async function listInboxLabelsServer(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<InboxLabelServerRow[]> {
  const { data } = await admin
    .from("inbox_labels")
    .select(LABEL_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []).map((r) => mapLabel(r as Record<string, unknown>));
}

export async function createInboxLabelServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    name: string;
    backgroundColor?: string;
    syncWaha?: boolean;
  },
): Promise<
  | { ok: true; label: InboxLabelServerRow }
  | { ok: false; error: string }
> {
  const name = params.name.trim();
  if (!name) return { ok: false, error: "empty_name" };

  let wahaLabelId: string | null = null;
  if (params.syncWaha !== false) {
    const config = await getWahaServerConfigForRestaurantAdmin(
      params.restaurantId,
    );
    if (config) {
      const created = await wahaCreateLabel({
        config,
        restaurantId: params.restaurantId,
        name,
        colorHex: params.backgroundColor ?? "#64748b",
      });
      if (created.ok && created.data?.id) {
        wahaLabelId = String(created.data.id);
      }
    }
  }

  const { data, error } = await admin
    .from("inbox_labels")
    .insert({
      restaurant_id: params.restaurantId,
      name,
      background_color: params.backgroundColor ?? "#64748b",
      waha_label_id: wahaLabelId,
    })
    .select(LABEL_SELECT)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }
  return { ok: true, label: mapLabel(data as Record<string, unknown>) };
}

async function resolveWhatsappChatIdForThread(
  admin: SupabaseClient,
  params: { restaurantId: string; threadKey: string },
): Promise<string | null> {
  const fromPseudo = wahaChatIdFromPseudoContactId(params.threadKey);
  if (fromPseudo) return fromPseudo;

  if (!isLinkedContactId(params.threadKey)) return null;

  const phone = await resolveWhatsappPhoneForContact(admin, {
    restaurantId: params.restaurantId,
    contactId: params.threadKey,
  });
  if (!phone) return null;
  return guestPhoneToWhatsAppChatId(phone);
}
/** Push Gwada thread labels that have waha_label_id onto the WhatsApp chat. */
export async function syncThreadLabelsToWahaServer(
  admin: SupabaseClient,
  params: { restaurantId: string; threadKey: string },
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const config = await getWahaServerConfigForRestaurantAdmin(
    params.restaurantId,
  );
  if (!config) return { ok: true, skipped: true };

  const chatId = await resolveWhatsappChatIdForThread(admin, params);
  if (!chatId) return { ok: true, skipped: true };

  const { data: assignments } = await admin
    .from("inbox_label_assignments")
    .select(`label:inbox_labels(${LABEL_SELECT})`)
    .eq("restaurant_id", params.restaurantId)
    .eq("thread_key", params.threadKey);

  const gwadaWahaIds = new Set<string>();
  for (const row of assignments ?? []) {
    const embedded = (row as unknown as { label: unknown }).label;
    const labelRaw = (
      Array.isArray(embedded) ? embedded[0] : embedded
    ) as Record<string, unknown> | null | undefined;
    const wahaId = labelRaw?.waha_label_id;
    if (typeof wahaId === "string" && wahaId.trim()) {
      gwadaWahaIds.add(wahaId.trim());
    }
  }

  const existing = await wahaGetChatLabels({
    config,
    restaurantId: params.restaurantId,
    chatId,
  });
  if (!existing.ok) {
    return { ok: false, error: existing.error };
  }

  /** Keep non-Gwada WAHA labels; replace Gwada-mapped ones with current assignment. */
  const { data: allGwada } = await admin
    .from("inbox_labels")
    .select("waha_label_id")
    .eq("restaurant_id", params.restaurantId)
    .not("waha_label_id", "is", null);

  const knownGwadaWahaIds = new Set(
    (allGwada ?? [])
      .map((r) => (r as { waha_label_id: string | null }).waha_label_id)
      .filter((id): id is string => Boolean(id?.trim())),
  );

  const keepForeign = existing.data
    .map((l) => l.id)
    .filter((id) => id && !knownGwadaWahaIds.has(id));

  const nextIds = [...new Set([...keepForeign, ...gwadaWahaIds])];
  const put = await wahaPutChatLabels({
    config,
    restaurantId: params.restaurantId,
    chatId,
    labelIds: nextIds,
  });
  if (!put.ok) return { ok: false, error: put.error };
  return { ok: true };
}

export async function setInboxThreadLabelServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    threadKey: string;
    labelId: string;
    assigned: boolean;
    syncWaha?: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  const threadKey = params.threadKey.trim();
  if (!threadKey) return { ok: false, error: "invalid_thread" };

  if (params.assigned) {
    const { error } = await admin.from("inbox_label_assignments").upsert(
      {
        restaurant_id: params.restaurantId,
        thread_key: threadKey,
        label_id: params.labelId,
      },
      { onConflict: "restaurant_id,thread_key,label_id" },
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin
      .from("inbox_label_assignments")
      .delete()
      .eq("restaurant_id", params.restaurantId)
      .eq("thread_key", threadKey)
      .eq("label_id", params.labelId);
    if (error) return { ok: false, error: error.message };
  }

  if (params.syncWaha !== false) {
    const sync = await syncThreadLabelsToWahaServer(admin, {
      restaurantId: params.restaurantId,
      threadKey,
    });
    if (!sync.ok) {
      console.warn("[inbox-labels] waha sync", sync.error);
    }
  }

  return { ok: true };
}

/** Best-effort: link existing Gwada labels to WAHA by name; import missing WAHA custom labels. */
export async function syncInboxLabelsFromWahaServer(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ ok: boolean; imported: number; linked: number; error?: string }> {
  const config = await getWahaServerConfigForRestaurantAdmin(restaurantId);
  if (!config) return { ok: true, imported: 0, linked: 0 };

  const remote = await wahaListLabels({ config, restaurantId });
  if (!remote.ok) return { ok: false, imported: 0, linked: 0, error: remote.error };

  const custom = remote.data.filter(
    (l) => l.isActive !== false && (l.type == null || l.type === 0 || l.type === 4 || l.type === 5),
  );

  const existing = await listInboxLabelsServer(admin, restaurantId);
  const byName = new Map(existing.map((l) => [l.name.toLowerCase(), l]));
  let imported = 0;
  let linked = 0;

  for (const waha of custom) {
    const name = waha.name?.trim();
    if (!name || !waha.id) continue;
    const local = byName.get(name.toLowerCase());
    if (local) {
      if (!local.waha_label_id) {
        await admin
          .from("inbox_labels")
          .update({ waha_label_id: String(waha.id) })
          .eq("id", local.id);
        linked += 1;
      }
      continue;
    }
    const { error } = await admin.from("inbox_labels").insert({
      restaurant_id: restaurantId,
      name,
      background_color: waha.colorHex?.trim() || "#64748b",
      waha_label_id: String(waha.id),
    });
    if (!error) imported += 1;
  }

  return { ok: true, imported, linked };
}
