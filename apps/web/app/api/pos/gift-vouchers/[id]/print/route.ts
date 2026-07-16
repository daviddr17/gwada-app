import {
  generatePosGiftVoucherA4Pdf,
  generatePosGiftVoucherThermalPdf,
} from "@/lib/pos/pos-gift-voucher-pdf";
import {
  getPosGiftVoucherById,
  markPosGiftVoucherReprinted,
} from "@/lib/pos/pos-gift-vouchers-server";
import { posError } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const format = url.searchParams.get("format") === "thermal" ? "thermal" : "a4";

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const voucher = await getPosGiftVoucherById(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    id,
  );
  if (!voucher) {
    return posError("voucher_not_found", 404);
  }
  if (voucher.status === "voided") {
    return posError("voucher_voided", 400);
  }

  const pdf =
    format === "thermal"
      ? await generatePosGiftVoucherThermalPdf(voucher)
      : await generatePosGiftVoucherA4Pdf(voucher);

  await markPosGiftVoucherReprinted({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    voucherId: voucher.id,
    actorProfileId: authResult.auth.userId,
  });

  const filename = `gutschein-${voucher.code}-${format}.pdf`;
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
