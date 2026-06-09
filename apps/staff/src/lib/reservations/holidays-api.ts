import { getGwadaApiBaseUrl } from "@/src/lib/env";
import { getStaffSupabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/auth-store";

async function staffAccessToken(): Promise<string | null> {
  const storeSession = useAuthStore.getState().session;
  const now = Math.floor(Date.now() / 1000);
  if (
    storeSession?.access_token &&
    (storeSession.expires_at ?? 0) - now > 60
  ) {
    return storeSession.access_token;
  }

  const sb = getStaffSupabase();
  const refreshed = await sb.auth.refreshSession();
  const session =
    refreshed.data.session ??
    (await sb.auth.getSession()).data.session ??
    storeSession;

  if (session && session !== storeSession) {
    useAuthStore.setState({ session });
  }

  return session?.access_token ?? null;
}

export async function fetchPublicHolidaysByDate(
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
): Promise<Record<string, string>> {
  if (!restaurantId || !fromYmd || !toYmd || fromYmd > toYmd) {
    return {};
  }

  const token = await staffAccessToken();
  if (!token) return {};

  const params = new URLSearchParams({
    restaurantId,
    from: fromYmd,
    to: toYmd,
  });

  try {
    const res = await fetch(
      `${getGwadaApiBaseUrl()}/api/holidays/range?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as { byDate?: Record<string, string> };
    return data.byDate ?? {};
  } catch {
    return {};
  }
}
