import "server-only";

import { generateAdminAuthActionLink } from "@/lib/auth/generate-admin-auth-action-link";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function buildSignupConfirmationLinkAdmin(
  admin: SupabaseClient,
  params: {
    email: string;
    redirectTo: string;
    password?: string;
    data?: Record<string, unknown>;
    siteUrl?: string | null;
  },
): Promise<{ ok: true; confirmLink: string } | { ok: false; error: string }> {
  const linkParams = params.password
    ? {
        type: "signup" as const,
        email: params.email,
        password: params.password,
        options: { redirectTo: params.redirectTo, data: params.data },
      }
    : {
        type: "signup" as const,
        email: params.email,
        options: { redirectTo: params.redirectTo, data: params.data },
      };

  const result = await generateAdminAuthActionLink(
    admin,
    linkParams as Parameters<SupabaseClient["auth"]["admin"]["generateLink"]>[0],
    {
      siteUrl: params.siteUrl,
      redirectTo: params.redirectTo,
      nextPath: (() => {
        try {
          return new URL(params.redirectTo).searchParams.get("next");
        } catch {
          return null;
        }
      })(),
    },
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, confirmLink: result.actionLink };
}
