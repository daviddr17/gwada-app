import { NextResponse } from "next/server";
import { loadGuestOrderStatusByToken } from "@/lib/ordering/create-guest-order-server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const result = await loadGuestOrderStatusByToken(token);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ order: result.order });
}
