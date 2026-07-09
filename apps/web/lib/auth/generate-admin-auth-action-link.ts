import { rewriteAdminAuthActionLink } from "@/lib/auth/rewrite-admin-auth-action-link";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAuthLinkRewriteOptions = {
  siteUrl?: string | null;
  redirectTo?: string | null;
};

type GenerateLinkParams = Parameters<
  SupabaseClient["auth"]["admin"]["generateLink"]
>[0];

/**
 * GoTrue `generateLink` + Umschreiben interner Kong-URLs für E-Mails.
 * Alle SMTP-Auth-Links sollen diese Hilfsfunktion nutzen.
 */
export async function generateAdminAuthActionLink(
  admin: SupabaseClient,
  linkParams: GenerateLinkParams,
  options: AdminAuthLinkRewriteOptions,
): Promise<{ ok: true; actionLink: string } | { ok: false; error: string }> {
  const { data, error } = await admin.auth.admin.generateLink(linkParams);
  const rawLink = data?.properties?.action_link ?? null;
  if (error || !rawLink) {
    return { ok: false, error: error?.message ?? "link_generation_failed" };
  }

  return {
    ok: true,
    actionLink: rewriteAdminAuthActionLink(rawLink, options),
  };
}
