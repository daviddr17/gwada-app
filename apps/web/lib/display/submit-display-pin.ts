"use client";

import type { DisplayContextResponse } from "@/lib/display/display-types";

export type SubmitDisplayPinResult =
  | { ok: true; context: DisplayContextResponse }
  | { ok: false; message: string };

export async function submitDisplayPin(
  pin: string,
): Promise<SubmitDisplayPinResult> {
  const res = await fetch("/api/display/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ pin }),
  });
  const data = (await res.json()) as {
    error?: string;
    context?: DisplayContextResponse;
  };

  if (!res.ok) {
    const message =
      data.error === "pin_invalid"
        ? "PIN falsch oder nicht vergeben."
        : "PIN falsch.";
    return { ok: false, message };
  }

  if (!data.context) {
    return { ok: false, message: "Anmeldung fehlgeschlagen." };
  }

  return { ok: true, context: data.context };
}
