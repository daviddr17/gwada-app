import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAdminService } from "../supabase-admin.service";

export type PosAuthContext = {
  restaurantId: string;
  profileId: string;
  deviceId: string | null;
};

@Injectable()
export class PosAuthGuard implements CanActivate {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { posAuth?: PosAuthContext }>();
    const restaurantId =
      (req.headers["x-restaurant-id"] as string | undefined)?.trim() ||
      (typeof req.query.restaurantId === "string" ? req.query.restaurantId : "") ||
      (typeof (req.body as { restaurantId?: string } | undefined)?.restaurantId === "string"
        ? (req.body as { restaurantId: string }).restaurantId
        : "");

    if (!restaurantId || !isUuid(restaurantId)) {
      throw new UnauthorizedException("restaurant_id_required");
    }

    const profileId =
      (req.headers["x-waiter-profile-id"] as string | undefined)?.trim() || "";
    if (!profileId || !isUuid(profileId)) {
      throw new UnauthorizedException("waiter_profile_id_required");
    }

    const deviceIdHeader = (req.headers["x-device-id"] as string | undefined)?.trim() || null;
    const sb = this.supabaseAdmin.getClient();

    // Soft staff check: profile linked as employee OR restaurant_staff with profile_id
    const { data: employee } = await sb
      .from("restaurant_employees")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .maybeSingle();

    if (!employee) {
      const { data: staff } = await sb
        .from("restaurant_staff")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .maybeSingle();
      if (!staff && process.env.POS_AUTH_RELAXED !== "1") {
        throw new UnauthorizedException("not_restaurant_staff");
      }
    }

    let deviceId: string | null = null;
    if (deviceIdHeader && isUuid(deviceIdHeader)) {
      const { data: device } = await sb
        .from("pos_devices")
        .select("id, is_active")
        .eq("id", deviceIdHeader)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (device?.is_active) deviceId = device.id as string;
    }

    req.posAuth = { restaurantId, profileId, deviceId };
    return true;
  }
}

export const PosAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PosAuthContext => {
    const req = ctx.switchToHttp().getRequest<Request & { posAuth?: PosAuthContext }>();
    if (!req.posAuth) throw new UnauthorizedException("missing_auth");
    return req.posAuth;
  },
);

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}
