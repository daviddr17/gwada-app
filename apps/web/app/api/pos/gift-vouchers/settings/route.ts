import {
  getPosGiftVoucherSettings,
  updatePosGiftVoucherSettings,
} from "@/lib/pos/pos-gift-vouchers-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import type { PosGiftVoucherPrintFormat } from "@/lib/types/pos-gift-vouchers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const settings = await getPosGiftVoucherSettings(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );
  return posJson({ settings });
}

type PatchBody = {
  restaurantId?: string;
  defaultValidityMonths?: number;
  voucherPrinterId?: string | null;
  printFormat?: PosGiftVoucherPrintFormat;
};

export async function PATCH(request: Request) {
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const result = await updatePosGiftVoucherSettings(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    {
      default_validity_months: body.defaultValidityMonths,
      voucher_printer_id: body.voucherPrinterId,
      print_format: body.printFormat,
    },
  );

  if (!result.settings) {
    return posError(result.error ?? "settings_save_failed", 400);
  }

  return posJson({ settings: result.settings });
}
