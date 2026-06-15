import "server-only";

import { allocationAmountCents, openLineQuantity } from "@gwada/pos-domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMolliePlatformOAuthAdmin,
  refreshMollieAccessToken,
} from "@/lib/integrations/mollie-oauth";
import { mergeMollieOAuthTokens } from "@/lib/integrations/mollie-integration-config";
import { mollieCreatePayment, mollieGetPayment } from "@/lib/pos/mollie-api-client";
import { runPosPaymentPipelineForPayment } from "@/lib/pos/pos-payment-pipeline";
import type { CollectAllocationInput } from "@/lib/pos/pos-session-settlement-server";
import { fetchPlatformMollieConfigAdmin } from "@/lib/supabase/platform-mollie-secrets-db";
import {
  fetchRestaurantMollieConfigAdmin,
  upsertRestaurantMollieIntegration,
} from "@/lib/supabase/restaurant-mollie-integration-db";
import { getPublicSiteUrl } from "@/lib/public-env";

export type MolliePaymentMethod = "card" | "paypal";

async function resolveMollieApiKey(
  restaurantId: string,
): Promise<{ apiKey: string } | { error: string }> {
  const restaurantCfg = await fetchRestaurantMollieConfigAdmin(restaurantId);
  if (restaurantCfg?.access_token) {
    let accessToken = restaurantCfg.access_token;

    const expiresAt = restaurantCfg.expires_at
      ? Date.parse(restaurantCfg.expires_at)
      : NaN;
    const needsRefresh =
      Number.isFinite(expiresAt) && expiresAt - Date.now() < 5 * 60 * 1000;

    if (needsRefresh && restaurantCfg.refresh_token) {
      const oauth = await getMolliePlatformOAuthAdmin();
      if (oauth) {
        const refreshed = await refreshMollieAccessToken({
          clientId: oauth.clientId,
          clientSecret: oauth.clientSecret,
          refreshToken: restaurantCfg.refresh_token,
        });
        if ("accessToken" in refreshed) {
          accessToken = refreshed.accessToken;
          const merged = mergeMollieOAuthTokens(
            {
              access_token: refreshed.accessToken,
              refresh_token: refreshed.refreshToken ?? undefined,
              expires_at: refreshed.expiresIn
                ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
                : undefined,
            },
            restaurantCfg,
          );
          await upsertRestaurantMollieIntegration({
            restaurantId,
            status: "working",
            config: merged,
            displayName: restaurantCfg.organization_name ?? null,
          });
        }
      }
    }

    return { apiKey: accessToken };
  }

  const platform = await fetchPlatformMollieConfigAdmin();
  if (platform.enabled && platform.apiKey) {
    return { apiKey: platform.apiKey };
  }

  return { error: "mollie_not_configured" };
}

async function validateAllocations(
  supabase: SupabaseClient,
  restaurantId: string,
  tableSessionId: string,
  allocations: CollectAllocationInput[],
): Promise<
  | {
      ok: true;
      amountCents: number;
      tipCents: number;
      primaryOrderId: string;
      resolved: Array<{
        orderLineId: string;
        quantity: number;
        amountCents: number;
        orderId: string;
      }>;
    }
  | { ok: false; error: string; status: number }
> {
  const { data: session, error: sessionError } = await supabase
    .from("pos_table_sessions")
    .select("id, restaurant_id, status")
    .eq("id", tableSessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { ok: false, error: "session_not_found", status: 404 };
  }
  if (session.restaurant_id !== restaurantId) {
    return { ok: false, error: "forbidden", status: 403 };
  }
  if (session.status !== "open") {
    return { ok: false, error: "session_closed", status: 400 };
  }

  const normalized = allocations
    .map((a) => ({
      orderLineId: a.orderLineId.trim(),
      quantity: Number(a.quantity),
    }))
    .filter((a) => a.orderLineId && Number.isFinite(a.quantity) && a.quantity > 0);

  if (normalized.length === 0) {
    return { ok: false, error: "empty_allocations", status: 400 };
  }

  const { data: orders } = await supabase
    .from("pos_orders")
    .select("id")
    .eq("table_session_id", tableSessionId)
    .eq("restaurant_id", restaurantId)
    .neq("status", "cancelled");

  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) {
    return { ok: false, error: "no_orders", status: 400 };
  }

  const { data: lines, error: linesError } = await supabase
    .from("pos_order_lines")
    .select(
      "id, order_id, quantity, paid_quantity, line_total_cents",
    )
    .in("order_id", orderIds);

  if (linesError) {
    return { ok: false, error: linesError.message, status: 500 };
  }

  const lineById = new Map((lines ?? []).map((l) => [l.id as string, l]));
  const merged = new Map<string, number>();
  for (const alloc of normalized) {
    merged.set(
      alloc.orderLineId,
      (merged.get(alloc.orderLineId) ?? 0) + alloc.quantity,
    );
  }

  let amountCents = 0;
  const resolved: Array<{
    orderLineId: string;
    quantity: number;
    amountCents: number;
    orderId: string;
  }> = [];

  for (const [orderLineId, qty] of merged) {
    const line = lineById.get(orderLineId);
    if (!line) {
      return { ok: false, error: "invalid_order_line", status: 400 };
    }
    const openQty = openLineQuantity(
      Number(line.quantity),
      Number(line.paid_quantity ?? 0),
    );
    if (qty > openQty + 1e-9) {
      return { ok: false, error: "allocation_exceeds_open_quantity", status: 400 };
    }
    const cents = allocationAmountCents(
      Number(line.line_total_cents),
      Number(line.quantity),
      qty,
    );
    amountCents += cents;
    resolved.push({
      orderLineId,
      quantity: qty,
      amountCents: cents,
      orderId: line.order_id as string,
    });
  }

  if (amountCents <= 0) {
    return { ok: false, error: "zero_amount", status: 400 };
  }

  return {
    ok: true,
    amountCents,
    tipCents: 0,
    primaryOrderId: resolved[0]!.orderId,
    resolved,
  };
}

export async function createMolliePosPayment(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  tableSessionId: string;
  allocations: CollectAllocationInput[];
  method: MolliePaymentMethod;
  tipCents?: number;
  redirectUrl?: string;
}): Promise<
  | {
      ok: true;
      paymentId: string;
      molliePaymentId: string;
      checkoutUrl: string | null;
    }
  | { ok: false; error: string; status: number }
> {
  const keyResult = await resolveMollieApiKey(params.restaurantId);
  if ("error" in keyResult) {
    return { ok: false, error: keyResult.error, status: 403 };
  }

  const validated = await validateAllocations(
    params.supabase,
    params.restaurantId,
    params.tableSessionId,
    params.allocations,
  );
  if (!validated.ok) return validated;

  const tipCents = Math.max(0, Math.round(params.tipCents ?? 0));
  const totalCents = validated.amountCents + tipCents;
  const mollieMethod = params.method === "paypal" ? "paypal" : "creditcard";
  const posMethod = params.method === "paypal" ? "paypal" : "card";

  const { data: payment, error: payError } = await params.supabase
    .from("pos_payments")
    .insert({
      restaurant_id: params.restaurantId,
      order_id: validated.primaryOrderId,
      amount_cents: totalCents,
      tip_cents: tipCents,
      method: posMethod,
      status: "open",
    })
    .select("id")
    .single();

  if (payError || !payment) {
    return { ok: false, error: "payment_failed", status: 500 };
  }

  const paymentId = payment.id as string;

  await params.supabase
    .from("pos_payments")
    .update({ split_group: paymentId })
    .eq("id", paymentId);

  const { error: allocError } = await params.supabase
    .from("pos_payment_line_allocations")
    .insert(
      validated.resolved.map((r) => ({
        payment_id: paymentId,
        order_line_id: r.orderLineId,
        quantity: r.quantity,
        amount_cents: r.amountCents,
      })),
    );

  if (allocError) {
    await params.supabase.from("pos_payments").delete().eq("id", paymentId);
    return { ok: false, error: "allocation_failed", status: 500 };
  }

  const site = getPublicSiteUrl() ?? "https://new.gwada.app";
  const webhookUrl = `${site}/api/pos/mollie/webhook`;
  const redirectUrl =
    params.redirectUrl ?? `gwada-staff://payment-return?paymentId=${paymentId}`;

  const mollieResult = await mollieCreatePayment({
    apiKey: keyResult.apiKey,
    amountCents: totalCents,
    description: `Gwada POS ${paymentId.slice(0, 8)}`,
    redirectUrl,
    webhookUrl,
    method: mollieMethod,
    metadata: {
      restaurant_id: params.restaurantId,
      pos_payment_id: paymentId,
      table_session_id: params.tableSessionId,
    },
  });

  if (!mollieResult.ok) {
    await params.supabase
      .from("pos_payment_line_allocations")
      .delete()
      .eq("payment_id", paymentId);
    await params.supabase.from("pos_payments").delete().eq("id", paymentId);
    return { ok: false, error: mollieResult.error, status: 502 };
  }

  const molliePaymentId = mollieResult.payment.id;

  await params.supabase
    .from("pos_payments")
    .update({ mollie_payment_id: molliePaymentId })
    .eq("id", paymentId);

  return {
    ok: true,
    paymentId,
    molliePaymentId,
    checkoutUrl: mollieResult.payment.checkoutUrl ?? null,
  };
}

export async function finalizeMolliePosPayment(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  posPaymentId: string;
  molliePaymentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: payment, error } = await params.supabase
    .from("pos_payments")
    .select("id, restaurant_id, status, mollie_payment_id")
    .eq("id", params.posPaymentId)
    .maybeSingle();

  if (error || !payment) return { ok: false, error: "payment_not_found" };
  if (payment.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "forbidden" };
  }
  if (payment.status === "paid") return { ok: true };

  const { data: allocations } = await params.supabase
    .from("pos_payment_line_allocations")
    .select("order_line_id, quantity")
    .eq("payment_id", params.posPaymentId);

  for (const row of allocations ?? []) {
    const lineId = row.order_line_id as string;
    const qty = Number(row.quantity);
    const { data: line } = await params.supabase
      .from("pos_order_lines")
      .select("paid_quantity")
      .eq("id", lineId)
      .maybeSingle();
    const nextPaid = Number(line?.paid_quantity ?? 0) + qty;
    await params.supabase
      .from("pos_order_lines")
      .update({ paid_quantity: nextPaid })
      .eq("id", lineId);
  }

  await params.supabase
    .from("pos_payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      mollie_payment_id: params.molliePaymentId,
    })
    .eq("id", params.posPaymentId);

  await runPosPaymentPipelineForPayment(params.posPaymentId);
  return { ok: true };
}

export async function syncMolliePaymentStatus(params: {
  restaurantId?: string;
  molliePaymentId: string;
}): Promise<
  | { ok: true; status: string; posPaymentId: string | null }
  | { ok: false; error: string }
> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  let restaurantId = params.restaurantId?.trim() ?? "";
  let posPaymentId: string | null = null;

  const { data: localRow } = await admin
    .from("pos_payments")
    .select("id, restaurant_id")
    .eq("mollie_payment_id", params.molliePaymentId)
    .maybeSingle();

  if (localRow) {
    restaurantId = localRow.restaurant_id as string;
    posPaymentId = localRow.id as string;
  }

  if (!restaurantId) {
    return { ok: false, error: "payment_not_found" };
  }

  const keyResult = await resolveMollieApiKey(restaurantId);
  if ("error" in keyResult) return { ok: false, error: keyResult.error };

  const remote = await mollieGetPayment({
    apiKey: keyResult.apiKey,
    molliePaymentId: params.molliePaymentId,
  });
  if (!remote.ok) return { ok: false, error: remote.error };

  posPaymentId =
    posPaymentId ?? remote.payment.metadata?.pos_payment_id ?? null;

  if (remote.payment.status === "paid" && posPaymentId) {
    await finalizeMolliePosPayment({
      supabase: admin,
      restaurantId,
      posPaymentId,
      molliePaymentId: params.molliePaymentId,
    });
  } else if (
    (remote.payment.status === "failed" ||
      remote.payment.status === "canceled" ||
      remote.payment.status === "expired") &&
    posPaymentId
  ) {
    await admin
      .from("pos_payment_line_allocations")
      .delete()
      .eq("payment_id", posPaymentId);
    await admin
      .from("pos_payments")
      .update({ status: "failed" })
      .eq("id", posPaymentId);
  }

  return {
    ok: true,
    status: remote.payment.status,
    posPaymentId,
  };
}
