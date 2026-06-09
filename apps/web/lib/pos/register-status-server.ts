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
  /** Soll Bar aus letztem Z-Abschluss — Vorschlag für Anfangsbestand beim Öffnen. */
  suggestedOpeningCashCents: number | null;
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

  let suggestedOpeningCashCents: number | null = null;
  if (!session && admin) {
    const { data: lastClosed } = await admin
      .from("pos_register_sessions")
      .select("expected_cash_cents, closing_cash_cents")
      .eq("restaurant_id", restaurantId)
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastClosed) {
      const expected = lastClosed.expected_cash_cents;
      const closing = lastClosed.closing_cash_cents;
      suggestedOpeningCashCents =
        expected != null
          ? Number(expected)
          : closing != null
            ? Number(closing)
            : null;
    }
  }

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
    suggestedOpeningCashCents,
    aggregate: session ? await loadRegisterSessionAggregate(session) : null,
  };
}
