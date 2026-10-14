#!/usr/bin/env node
/**
 * Live verify: Zur Schlagd / SB Union messages + WAHA session webhook events.
 * Optionally backfills SB Union captions + attachment meta from WAHA history.
 * Usage: env with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SB_UNION_CHAT_ID = "49566172321@c.us";
const SB_UNION_CONVERSATION_KEY = `waha:${SB_UNION_CHAT_ID}`;
const MEDIA_LABELS = new Set([
  "Bild",
  "Datei",
  "datei",
  "Video",
  "Sprachnachricht",
  "WhatsApp-Anhang",
  "WhatsApp-Nachricht",
]);

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Env ${name} fehlt`);
  return v;
}

function wahaSessionName(restaurantId) {
  const compact = restaurantId.replace(/[^a-zA-Z0-9]/g, "");
  return `gwada${compact.slice(0, 48)}`;
}

function readStringField(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value) {
  return value && typeof value === "object" ? value : null;
}

function unwrapWahaProtobufMessage(data) {
  if (!data) return null;
  const message = asRecord(data.message) ?? data;
  if (!message) return null;
  const wrappers = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "editedMessage",
    "futureProofMessage",
  ];
  for (const key of wrappers) {
    const wrapped = asRecord(message[key]);
    const nested = asRecord(wrapped?.message);
    if (nested) return unwrapWahaProtobufMessage({ message: nested });
  }
  return message;
}

function textFromMediaNode(node) {
  if (!node) return "";
  return (
    readStringField(node.caption) ||
    readStringField(node.text) ||
    readStringField(node.title) ||
    readStringField(node.description) ||
    readStringField(node.contentText) ||
    readStringField(node.name) ||
    ""
  );
}

function extractWahaMessageDisplayText(raw) {
  const mediaCaption =
    raw.media && typeof raw.media === "object"
      ? readStringField(raw.media.caption)
      : "";
  const top =
    readStringField(raw.body) ||
    readStringField(raw.caption) ||
    mediaCaption;
  if (top) return top;

  const data = asRecord(raw._data);
  if (!data) return "";

  const topDataCaption =
    readStringField(data.caption) ||
    readStringField(data.body) ||
    readStringField(data.text);
  if (topDataCaption) return topDataCaption;

  const message = unwrapWahaProtobufMessage(data);
  if (!message) return "";

  const conversation = readStringField(message.conversation);
  if (conversation) return conversation;

  const extended = asRecord(message.extendedTextMessage);
  const extendedText =
    readStringField(extended?.text) || readStringField(extended?.description);
  if (extendedText) return extendedText;

  for (const key of [
    "imageMessage",
    "videoMessage",
    "documentMessage",
    "audioMessage",
    "pttMessage",
    "stickerMessage",
  ]) {
    const caption = textFromMediaNode(asRecord(message[key]));
    if (caption) return caption;
  }

  const buttons = asRecord(message.buttonsMessage);
  const buttonsText =
    readStringField(buttons?.contentText) ||
    readStringField(buttons?.headerText) ||
    readStringField(buttons?.footerText);
  if (buttonsText) return buttonsText;

  const list = asRecord(message.listMessage);
  const listText =
    readStringField(list?.description) ||
    readStringField(list?.title) ||
    readStringField(list?.footerText);
  if (listText) return listText;

  const interactive = asRecord(message.interactiveMessage);
  const interactiveBody = asRecord(interactive?.body);
  const interactiveText =
    readStringField(interactiveBody?.text) ||
    readStringField(asRecord(interactive?.header)?.title) ||
    readStringField(asRecord(interactive?.footer)?.text);
  if (interactiveText) return interactiveText;

  return "";
}

function detectMediaKind(raw) {
  const type = String(raw.type ?? "").toLowerCase();
  if (type.includes("image") || type === "sticker") return "image";
  if (type.includes("video")) return "video";
  if (type.includes("ptt") || type.includes("voice") || type.includes("audio"))
    return "voice";
  if (type.includes("document") || type.includes("file")) return "file";
  if (raw.hasMedia === true && !extractWahaMessageDisplayText(raw)) return "image";

  const message = unwrapWahaProtobufMessage(asRecord(raw._data));
  if (!message) return null;
  if (message.imageMessage || message.stickerMessage) return "image";
  if (message.videoMessage) return "video";
  if (message.audioMessage || message.pttMessage) return "voice";
  if (message.documentMessage) return "file";
  return null;
}

function dbKindAndMeta(kind) {
  if (kind === "image") {
    return { kind: "image", fileName: "Bild", mimeType: "image/jpeg" };
  }
  if (kind === "video") {
    return { kind: "file", fileName: "Video", mimeType: "video/mp4" };
  }
  if (kind === "voice") {
    return {
      kind: "file",
      fileName: "Sprachnachricht",
      mimeType: "audio/ogg; codecs=opus",
    };
  }
  return {
    kind: "file",
    fileName: "Datei",
    mimeType: "application/octet-stream",
  };
}

function mediaLabel(kind) {
  if (kind === "image") return "Bild";
  if (kind === "video") return "Video";
  if (kind === "voice") return "Sprachnachricht";
  if (kind) return "Datei";
  return "";
}

async function backfillSbUnionFromWaha(admin, restaurantId, baseUrl, apiKey) {
  const sessionName = wahaSessionName(restaurantId);
  const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(SB_UNION_CHAT_ID)}/messages?limit=80&downloadMedia=false`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Api-Key": apiKey },
  });
  if (!res.ok) {
    console.log(`RESULT backfill_waha_http=${res.status}`);
    return;
  }
  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : (raw.messages ?? []);
  console.log(`RESULT backfill_waha_fetched=${list.length}`);

  const { data: dbMsgs } = await admin
    .from("contact_messages")
    .select("id, body, external_source_id")
    .eq("restaurant_id", restaurantId)
    .eq("platform", "whatsapp")
    .eq("conversation_key", SB_UNION_CONVERSATION_KEY)
    .order("created_at", { ascending: false })
    .limit(80);

  const byExt = new Map(
    (dbMsgs ?? []).map((m) => [m.external_source_id, m]),
  );

  let bodiesUpdated = 0;
  let attachmentsAdded = 0;
  let captionsFound = 0;

  for (const m of list) {
    if (!m?.id) continue;
    const ext = `waha:${m.id}`;
    const dbRow = byExt.get(ext);
    if (!dbRow) continue;

    const caption = extractWahaMessageDisplayText(m);
    const mediaKind = detectMediaKind(m);
    if (caption && !MEDIA_LABELS.has(caption)) captionsFound += 1;

    const nextBody =
      caption ||
      (MEDIA_LABELS.has((dbRow.body ?? "").trim())
        ? mediaLabel(mediaKind) || dbRow.body
        : dbRow.body);

    if (nextBody && nextBody !== dbRow.body) {
      const { error } = await admin
        .from("contact_messages")
        .update({ body: nextBody })
        .eq("id", dbRow.id)
        .eq("restaurant_id", restaurantId);
      if (!error) {
        bodiesUpdated += 1;
        dbRow.body = nextBody;
      }
    }

    if (!mediaKind) continue;

    const { data: existingAtt } = await admin
      .from("contact_message_attachments")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("message_id", dbRow.id)
      .limit(1);
    if ((existingAtt?.length ?? 0) > 0) continue;

    const meta = dbKindAndMeta(mediaKind);
    const { error: attErr } = await admin
      .from("contact_message_attachments")
      .insert({
        id: randomUUID(),
        restaurant_id: restaurantId,
        message_id: dbRow.id,
        kind: meta.kind,
        file_name: meta.fileName,
        mime_type: meta.mimeType.slice(0, 127),
        byte_size: null,
        storage_path: `waha:${SB_UNION_CHAT_ID}:${m.id}`,
      });
    if (!attErr) attachmentsAdded += 1;
  }

  console.log(
    `RESULT backfill bodiesUpdated=${bodiesUpdated} attachmentsAdded=${attachmentsAdded} captionsFound=${captionsFound}`,
  );
}

async function summarizeSbUnion(admin, restaurantId) {
  const { data: msgs } = await admin
    .from("contact_messages")
    .select(
      "id, contact_id, conversation_key, direction, body, external_source_id, created_at, delivery_status",
    )
    .eq("restaurant_id", restaurantId)
    .eq("platform", "whatsapp")
    .eq("conversation_key", SB_UNION_CONVERSATION_KEY)
    .order("created_at", { ascending: false })
    .limit(40);

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
    if (body && !MEDIA_LABELS.has(body) && a.length > 0) {
      withCaptionAndMedia += 1;
    }
    if (
      a.some((x) => x.kind === "image" || x.file_name === "Bild") ||
      body === "Bild"
    ) {
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
  return { msgs, withCaptionAndMedia };
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

  console.log(
    `RESULT sb_union_thread_key=${SB_UNION_CONVERSATION_KEY}`,
  );

  // WAHA config first — backfill then verify
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
    await summarizeSbUnion(admin, restaurant.id);
    return;
  }

  console.log("RESULT sb_union_before_backfill");
  await summarizeSbUnion(admin, restaurant.id);
  await backfillSbUnionFromWaha(admin, restaurant.id, baseUrl, apiKey);
  console.log("RESULT sb_union_after_backfill");
  await summarizeSbUnion(admin, restaurant.id);

  // Outbound fromMe samples restaurant-wide (recent)
  const { data: outbound } = await admin
    .from("contact_messages")
    .select(
      "id, body, external_source_id, created_at, delivery_status, suppress_notifications",
    )
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

  // Phone-outbound candidates: fromMe external ids, not reservation automation suppress
  const { data: phoneOut } = await admin
    .from("contact_messages")
    .select(
      "id, body, external_source_id, created_at, delivery_status, suppress_notifications, conversation_key",
    )
    .eq("restaurant_id", restaurant.id)
    .eq("platform", "whatsapp")
    .eq("direction", "outbound")
    .like("external_source_id", "waha:true_%")
    .or("suppress_notifications.is.null,suppress_notifications.eq.false")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log(
    "RESULT phone_outbound_candidates=",
    JSON.stringify(
      (phoneOut ?? []).map((m) => ({
        body: (m.body ?? "").slice(0, 100),
        external_source_id: m.external_source_id,
        conversation_key: m.conversation_key,
        created_at: m.created_at,
        suppress_notifications: m.suppress_notifications,
      })),
    ),
  );

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
