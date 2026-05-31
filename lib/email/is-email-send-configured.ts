import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Versand nur möglich, wenn Service-Role (Passwörter serverseitig) verfügbar ist. */
export function isEmailSendConfigured(): boolean {
  return createSupabaseAdminClient() != null;
}
