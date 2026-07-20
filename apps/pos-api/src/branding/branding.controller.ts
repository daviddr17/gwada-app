import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { SupabaseAdminService } from "../supabase-admin.service";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

@Controller("v1/branding")
export class BrandingController {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  @Get()
  async getBranding(@Query("restaurantId") restaurantId: string) {
    const rid = restaurantId?.trim() ?? "";
    if (!isUuid(rid)) throw new BadRequestException("restaurantId required");

    const sb = this.supabaseAdmin.getClient();
    const { data, error } = await sb
      .from("restaurants")
      .select(
        "id, name, legal_name, brand_accent_hex, address_line1, address_line2, phone",
      )
      .eq("id", rid)
      .maybeSingle();

    if (error || !data) {
      throw new BadRequestException("restaurant_not_found");
    }

    return {
      restaurantId: data.id,
      name: data.name,
      legalName: data.legal_name ?? data.name,
      brandAccentHex: data.brand_accent_hex ?? "#EAB308",
      addressLine1: data.address_line1,
      addressLine2: data.address_line2,
      phone: data.phone ?? null,
      venue: {
        name: (data.legal_name as string | null) || (data.name as string),
        street: data.address_line1,
        cityLine: data.address_line2,
        phone: data.phone ?? null,
      },
    };
  }
}
