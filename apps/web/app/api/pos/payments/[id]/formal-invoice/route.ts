import { assertAccountingApi } from "@/lib/accounting/assert-accounting-api";
import {
  createFormalInvoiceFromPosPayment,
  loadPosFormalInvoiceDraft,
} from "@/lib/pos/pos-formal-invoice-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import type { AccountingRecipientSnapshot } from "@/lib/types/accounting";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id: paymentId } = await context.params;
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");

  const posAuth = await authorizePosRestaurant(request, restaurantId);
  if (!posAuth.ok) return posError(posAuth.error, posAuth.status);

  const accounting = await assertAccountingApi(
    posAuth.auth.restaurantId,
    "create",
  );
  if (!accounting.ok) {
    return posError(accounting.error, accounting.status);
  }

  const { draft, error } = await loadPosFormalInvoiceDraft(
    posAuth.auth.supabase,
    posAuth.auth.restaurantId,
    paymentId,
  );
  if (error || !draft) {
    return posError(error ?? "draft_failed", error === "forbidden" ? 403 : 404);
  }
  return posJson({ draft });
}

type CreateBody = {
  restaurantId?: string;
  companyName?: string | null;
  personName?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  countryCode?: string | null;
  email?: string | null;
  phone?: string | null;
  voucherDate?: string | null;
  dueDate?: string | null;
};

export async function POST(request: Request, context: RouteContext) {
  const { id: paymentId } = await context.params;
  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const restaurantId = body.restaurantId ?? null;
  const posAuth = await authorizePosRestaurant(request, restaurantId);
  if (!posAuth.ok) return posError(posAuth.error, posAuth.status);

  const accounting = await assertAccountingApi(
    posAuth.auth.restaurantId,
    "create",
  );
  if (!accounting.ok) {
    return posError(accounting.error, accounting.status);
  }
  if (!accounting.userId) {
    return posError("forbidden", 403);
  }

  const company = body.companyName?.trim() || "";
  const person = body.personName?.trim() || "";
  const recipient: AccountingRecipientSnapshot = {
    name: company || person,
    supplement: company && person ? person : null,
    street: body.street?.trim() || null,
    zip: body.zip?.trim() || null,
    city: body.city?.trim() || null,
    countryCode: body.countryCode?.trim() || "DE",
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
  };

  const { row, error } = await createFormalInvoiceFromPosPayment({
    supabase: accounting.sb,
    restaurantId: posAuth.auth.restaurantId,
    userId: accounting.userId,
    paymentId,
    recipient,
    voucherDate: body.voucherDate?.trim() || undefined,
    dueDate: body.dueDate?.trim() || null,
    email: body.email,
    phone: body.phone,
  });

  if (error || !row) {
    return posError(error ?? "create_failed", 400);
  }
  return posJson({ invoice: row });
}
