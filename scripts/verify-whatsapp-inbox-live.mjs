#!/usr/bin/env node
/**
 * Live verify: Zur Schlagd / SB Union messages + WAHA session webhook events.
 * Usage: env with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Env ${name} fehlt`);
  return v;
}

function wahaSessionName(restaurantId) {
  const compact = restaurantId.replace(/[^a-zA-Z0-9]/g, "");
  return `gwada${compact.slice(0, 48)}`;
}

async function main() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: restaurants, error: rErr } = await admin
    .from("restaurants")
    .select("id, name")
    .ilike("name", "%schlagd%");
  if (rErr) throw new Error(rErr.message);
  const restaurant = (restaurants ?? [])[0];
  if (!restaurant) {
    console.log("RESULT restaurant=NOT_FOUND");
    process.exit(1);
  }
  console.log(`RESULT restaurant=${restaurant.name} id=${restaurant.id}`);

  const phoneDigits = "49566172321";
  const { data: phones } = await admin
    .from("contact_phones")
    .select("contact_id, phone_display, phone_e164")
    .eq("restaurant_id", restaurant.id)
    .or(
      `phone_e164.ilike.%${phoneDigits}%,phone_display.ilike.%${phoneDigits}%,phone_display.ilike.%05661%72321%`,
    )
    .limit(10);

  let contactIds = [...new Set((phones ?? []).map((p) => p.contact_id))];
  console.log("RESULT phones=", JSON.stringify(phones ?? []));

  const { data: byName } = await admin
    .from("contacts")
    .select("id, first_name, last_name, company")
    .eq("restaurant_id", restaurant.id)
    .or(
      "company.ilike.%SB Union%,first_name.ilike.%sb-union%,first_name.ilike.%SB Union%,last_name.ilike.%Union%,company.ilike.%Union%",
    )
    .limit(20);
  console.log(
    "RESULT contacts_by_name=",
    JSON.stringify(
      (byName ?? []).map((c) => ({
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" "),
        company: c.company,
      })),
    ),
  );
  for (const c of byName ?? []) contactIds.push(c.id);

  const { data: messaging } = await admin
    .from("contact_messaging_ids")
    .select("contact_id, platform, external_sender_id")
    .eq("restaurant_id", restaurant.id)
    .eq("platform", "whatsapp")
    .or(
      `external_sender_id.ilike.%${phoneDigits}%,external_sender_id.ilike.%566172321%`,
    )
    .limit(20);
  console.log("RESULT messaging_ids=", JSON.stringify(messaging ?? []));
  for (const m of messaging ?? []) contactIds.push(m.contact_id);

  // Pseudo-threads / labels (unlinked WAHA chats)
  const { data: labeled } = await admin
    .from("contact_messages")
    .select(
      "id, contact_id, conversation_key, conversation_label, body, direction, external_source_id, created_at",
    )
    .eq("restaurant_id", restaurant.id)
    .eq("platform", "whatsapp")
    .or(
      `conversation_label.ilike.%SB Union%,conversation_label.ilike.%sb-union%,conversation_key.ilike.%${phoneDigits}%,conversation_key.ilike.%566172321%,body.ilike.%SB Union%`,
    )
    .order("created_at", { ascending: false })
    .limit(40);
  console.log(
    "RESULT labeled_or_phone_messages=",
    JSON.stringify(
      (labeled ?? []).slice(0, 20).map((m) => ({
        contact_id: m.contact_id,
        conversation_key: m.conversation_key,
        label: m.conversation_label,
        direction: m.direction,
        body: (m.body ?? "").slice(0, 120),
        external_source_id: m.external_source_id,
        created_at: m.created_at,
      })),
    ),
  );
  for (const m of labeled ?? []) {
    if (m.contact_id) contactIds.push(m.contact_id);
    if (m.conversation_key) contactIds.push(m.conversation_key);
  }
  contactIds = [...new Set(contactIds.filter(Boolean))];

  if (contactIds.length > 0) {
    const uuidIds = contactIds.filter((id) =>
      /^[0-9a-f-]{36}$/i.test(id),
    );
    const pseudoKeys = contactIds.filter((id) => !/^[0-9a-f-]{36}$/i.test(id));
    if (uuidIds.length) {
      const { data: contacts } = await admin
        .from("contacts")
        .select("id, first_name, last_name, company")
        .in("id", uuidIds);
      console.log("RESULT contacts=", JSON.stringify(contacts));
    }

    let msgs = [];
    if (uuidIds.length) {
      const { data } = await admin
        .from("contact_messages")
        .select(
          "id, contact_id, conversation_key, direction, body, external_source_id, created_at, delivery_status",
        )
        .eq("restaurant_id", restaurant.id)
        .eq("platform", "whatsapp")
        .in("contact_id", uuidIds)
        .order("created_at", { ascending: false })
        .limit(40);
      msgs = data ?? [];
    }
    if (pseudoKeys.length) {
      const { data } = await admin
        .from("contact_messages")
        .select(
          "id, contact_id, conversation_key, direction, body, external_source_id, created_at, delivery_status",
        )
        .eq("restaurant_id", restaurant.id)
        .eq("platform", "whatsapp")
        .in("conversation_key", pseudoKeys)
        .order("created_at", { ascending: false })
        .limit(40);
      msgs = [...msgs, ...(data ?? [])];
    }
    // Prefer labeled hits if contact-linked empty
    if (msgs.length === 0 && (labeled ?? []).length) {
      msgs = labeled;
    }

    const messageIds = (msgs ?? []).map((m) => m.id);
    const { data: atts } = messageIds.length
      ? await admin
          .from("contact_message_attachments")
          .select("message_id, kind, file_name, storage_path")
          .in("message_id", messageIds)
      : { data: [] };
    const attByMsg = new Map();
    for (const a of atts ?? []) {
      const list = attByMsg.get(a.message_id) ?? [];
      list.push(a);
      attByMsg.set(a.message_id, list);
    }

    let emptyBodies = 0;
    let withCaptionAndMedia = 0;
    let imageLike = 0;
    for (const m of msgs ?? []) {
      const body = (m.body ?? "").trim();
      const a = attByMsg.get(m.id) ?? [];
      if (!body && a.length === 0) emptyBodies += 1;
      if (body && body !== "Bild" && body !== "WhatsApp-Anhang" && a.length > 0) {
        withCaptionAndMedia += 1;
      }
      if (a.some((x) => x.kind === "image" || x.file_name === "Bild") || body === "Bild") {
        imageLike += 1;
      }
    }

    console.log(
      "RESULT sb_union_messages=",
      JSON.stringify(
        (msgs ?? []).slice(0, 15).map((m) => ({
          direction: m.direction,
          body: (m.body ?? "").slice(0, 160),
          external_source_id: m.external_source_id,
          created_at: m.created_at,
          attachments: attByMsg.get(m.id) ?? [],
        })),
      ),
    );
    console.log(
      `RESULT sb_union_stats emptyBodies=${emptyBodies} withCaptionAndMedia=${withCaptionAndMedia} imageLike=${imageLike} total=${msgs?.length ?? 0}`,
    );
  }

  // Outbound fromMe samples restaurant-wide (recent)
  const { data: outbound } = await admin
    .from("contact_messages")
    .select("id, body, external_source_id, created_at, delivery_status, suppress_notifications")
    .eq("restaurant_id", restaurant.id)
    .eq("platform", "whatsapp")
    .eq("direction", "outbound")
    .like("external_source_id", "waha:%")
    .order("created_at", { ascending: false })
    .limit(15);
  console.log(
    "RESULT recent_outbound_waha=",
    JSON.stringify(
      (outbound ?? []).map((m) => ({
        body: (m.body ?? "").slice(0, 100),
        external_source_id: m.external_source_id,
        created_at: m.created_at,
        suppress_notifications: m.suppress_notifications,
        delivery_status: m.delivery_status,
      })),
    ),
  );

  // WAHA session webhook events
  const { data: platform } = await admin
    .from("platform_integrations")
    .select("config")
    .eq("key", "whatsapp")
    .maybeSingle();
  const cfg = platform?.config ?? {};
  const baseUrl = String(cfg.waha_base_url ?? "")
    .trim()
    .replace(/\/+$/, "");
  const apiKey = String(cfg.waha_api_key ?? "").trim();
  if (!baseUrl || !apiKey) {
    console.log("RESULT waha_config=missing");
    return;
  }
  const sessionName = wahaSessionName(restaurant.id);
  const res = await fetch(
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}`,
    { headers: { Accept: "application/json", "X-Api-Key": apiKey } },
  );
  if (!res.ok) {
    console.log(`RESULT waha_session_http=${res.status}`);
    return;
  }
  const session = await res.json();
  const events =
    session?.config?.webhooks?.[0]?.events ??
    session?.engine?.webhooks?.[0]?.events ??
    null;
  const webhookUrl =
    session?.config?.webhooks?.[0]?.url ??
    session?.engine?.webhooks?.[0]?.url ??
    null;
  console.log(
    `RESULT waha_session=${sessionName} status=${session?.status ?? "?"} webhookUrl=${webhookUrl} events=${JSON.stringify(events)}`,
  );
  const hasAny = Array.isArray(events) && events.includes("message.any");
  console.log(`RESULT message_any_registered=${hasAny}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
