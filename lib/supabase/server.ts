import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";

async function resolveSupabaseUrlForServer(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host ? `${proto}://${host}` : null;
  return resolveSupabaseUrl(origin);
}

/**
 * Server Components, Server Actions, Route Handlers — always create per request.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = await resolveSupabaseUrlForServer();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Component — session refresh runs in `proxy.ts`. */
        }
      },
    },
  });
}
