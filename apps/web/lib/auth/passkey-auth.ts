"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  humanizePasskeyErrorMessage,
  isPasskeyUserCancelledError,
} from "@/lib/auth/passkey-error-messages";

export type GwadaPasskeyListItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

export function browserSupportsPasskeys(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof PublicKeyCredential !== "undefined" &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
      "function"
  );
}

export async function signInWithPasskeyClient(): Promise<{
  error: Error | null;
  cancelled: boolean;
}> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.auth.signInWithPasskey();
  if (error) {
    if (isPasskeyUserCancelledError(error)) {
      return { error: null, cancelled: true };
    }
    const message = humanizePasskeyErrorMessage(error.message);
    return {
      error: new Error(message || "Passkey-Anmeldung fehlgeschlagen."),
      cancelled: false,
    };
  }
  if (!data.session) {
    return {
      error: new Error("Passkey-Anmeldung fehlgeschlagen."),
      cancelled: false,
    };
  }
  return { error: null, cancelled: false };
}

export async function registerPasskeyClient(): Promise<{
  passkey: { id: string; friendly_name?: string } | null;
  error: Error | null;
  cancelled: boolean;
}> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.auth.registerPasskey();
  if (error) {
    if (isPasskeyUserCancelledError(error)) {
      return { passkey: null, error: null, cancelled: true };
    }
    const message = humanizePasskeyErrorMessage(error.message);
    return {
      passkey: null,
      error: new Error(message || "Passkey konnte nicht angelegt werden."),
      cancelled: false,
    };
  }
  return { passkey: data, error: null, cancelled: false };
}

export async function listPasskeysClient(): Promise<{
  passkeys: GwadaPasskeyListItem[];
  error: Error | null;
}> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.auth.passkey.list();
  if (error) {
    return {
      passkeys: [],
      error: new Error(humanizePasskeyErrorMessage(error.message)),
    };
  }
  return { passkeys: data ?? [], error: null };
}

export async function deletePasskeyClient(passkeyId: string): Promise<{
  error: Error | null;
}> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.auth.passkey.delete({ passkeyId });
  if (error) {
    return { error: new Error(humanizePasskeyErrorMessage(error.message)) };
  }
  return { error: null };
}

export async function renamePasskeyClient(
  passkeyId: string,
  friendlyName: string,
): Promise<{ error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.auth.passkey.update({ passkeyId, friendlyName });
  if (error) {
    return { error: new Error(humanizePasskeyErrorMessage(error.message)) };
  }
  return { error: null };
}
