import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import {
  wahaStartRecording,
  wahaStartTyping,
  wahaStopRecording,
  wahaStopTyping,
} from "@/lib/waha/waha-presence";

export async function setWahaTypingClient(params: {
  restaurantId: string;
  chatId: string;
  action: "start" | "stop" | "recording" | "recording_stop";
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/contact-messages/waha/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function deleteWahaMessageClient(params: {
  restaurantId: string;
  chatId: string;
  messageId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/contact-messages/waha/messages/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function editWahaMessageClient(params: {
  restaurantId: string;
  chatId: string;
  messageId: string;
  text: string;
  contactId?: string;
  previousText?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/contact-messages/waha/messages/edit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
