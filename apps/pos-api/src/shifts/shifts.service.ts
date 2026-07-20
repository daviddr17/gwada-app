import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { SupabaseAdminService } from "../supabase-admin.service";

/**
 * 4-Augen Schichtübergabe: Ziel-Kellner bestätigt mit Display-PIN (bcrypt/hash RPC)
 * oder Demo-Hash-Vergleich wenn RPC fehlt.
 */
@Injectable()
export class ShiftsService {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  async transferSessions(params: {
    restaurantId: string;
    fromProfileId: string;
    toProfileId: string;
    sessionIds: string[];
    toPin: string;
  }) {
    if (!params.sessionIds.length) {
      return { ok: false as const, error: "no_sessions", status: 400 };
    }
    if (params.fromProfileId === params.toProfileId) {
      return { ok: false as const, error: "same_waiter", status: 400 };
    }

    const sb = this.supabaseAdmin.getClient();
    const pinOk = await this.verifyPin(
      params.restaurantId,
      params.toProfileId,
      params.toPin,
    );
    if (!pinOk) {
      return { ok: false as const, error: "invalid_pin", status: 403 };
    }

    const { data: sessions, error } = await sb
      .from("pos_table_sessions")
      .select("id, owner_profile_id, status")
      .eq("restaurant_id", params.restaurantId)
      .in("id", params.sessionIds);

    if (error) return { ok: false as const, error: error.message, status: 500 };

    const transferable = (sessions ?? []).filter(
      (s) =>
        ["open", "bill", "paid_pending_release"].includes(s.status as string) &&
        (s.owner_profile_id === params.fromProfileId ||
          process.env.POS_AUTH_RELAXED === "1"),
    );

    if (!transferable.length) {
      return { ok: false as const, error: "no_transferable_sessions", status: 400 };
    }

    const ids = transferable.map((s) => s.id as string);
    const { error: updError } = await sb
      .from("pos_table_sessions")
      .update({ owner_profile_id: params.toProfileId })
      .in("id", ids);

    if (updError) return { ok: false as const, error: updError.message, status: 500 };

    return {
      ok: true as const,
      transferredSessionIds: ids,
      fromProfileId: params.fromProfileId,
      toProfileId: params.toProfileId,
    };
  }

  private async verifyPin(
    restaurantId: string,
    profileId: string,
    pin: string,
  ): Promise<boolean> {
    if (process.env.POS_AUTH_RELAXED === "1" && pin.length >= 4) return true;

    const sb = this.supabaseAdmin.getClient();
    // Prefer existing display-pin resolve RPC if present
    const { data: byPin, error } = await sb.rpc(
      "resolve_restaurant_staff_by_display_pin",
      {
        p_restaurant_id: restaurantId,
        p_pin: pin,
      },
    );

    if (!error && byPin) {
      const row = Array.isArray(byPin) ? byPin[0] : byPin;
      const resolvedProfile =
        (row as { profile_id?: string } | null)?.profile_id ?? null;
      return resolvedProfile === profileId;
    }

    // Fallback: compare sha256 of pin to staff.display_pin_hash if stored that way (rare)
    const { data: staff } = await sb
      .from("restaurant_staff")
      .select("display_pin_hash, profile_id")
      .eq("restaurant_id", restaurantId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (!staff?.display_pin_hash) return false;
    const hash = createHash("sha256").update(pin, "utf8").digest("hex");
    return staff.display_pin_hash === hash;
  }
}
