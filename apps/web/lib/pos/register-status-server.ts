import "server-only";

import {
  getOpenRegisterSession,
  loadRegisterSessionAggregate,
} from "@/lib/pos/register-report-aggregate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RegisterStatusDto = {
  isOpen: boolean;
  sessionId: string | null;
  openedAt: string | null;
  openingCashCents: number | null;
  lastClosingZNr: number | null;
  lastClosingAt: string | null;
  aggregate: Awaited<ReturnType<typeof loadRegisterSessionAggregate>> | null;
};

export async function loadRegisterStatus(
  restaurantId: string,
): Promise<RegisterStatusDto> {
  const admin = createSupabaseAdminClient();

  const { data: config } = admin
    ? await admin
        .from("pos_restaurant_fiscal_config")
        .select("last_closing_z_nr, last_closing_at, register_opened_at")
        .eq("restaurant_id", restaurantId)
        .maybeSingle()
    : { data: null };

  const session = await getOpenRegisterSession(restaurantId);

  return {
    isOpen: Boolean(session),
    sessionId: session?.id ?? null,
    openedAt: session?.opened_at ?? config?.register_opened_at ?? null,
    openingCashCents: session ? Number(session.opening_cash_cents) : null,
    lastClosingZNr:
      config?.last_closing_z_nr == null
        ? null
        : Number(config.last_closing_z_nr),
    lastClosingAt: config?.last_closing_at ?? null,
    aggregate: session ? await loadRegisterSessionAggregate(session) : null,
  };
}
