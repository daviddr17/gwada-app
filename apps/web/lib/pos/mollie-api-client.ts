import "server-only";

type MollieAmount = { currency: string; value: string };

export type MolliePaymentResource = {
  id: string;
  status: string;
  amount: MollieAmount;
  method?: string | null;
  checkoutUrl?: string | null;
  _links?: { checkout?: { href?: string } };
  metadata?: Record<string, string>;
};

function authHeader(apiKey: string): string {
  return `Bearer ${apiKey}`;
}

export async function mollieCreatePayment(params: {
  apiKey: string;
  amountCents: number;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  method?: "creditcard" | "paypal" | null;
  metadata: Record<string, string>;
}): Promise<
  | { ok: true; payment: MolliePaymentResource }
  | { ok: false; error: string }
> {
  const value = (params.amountCents / 100).toFixed(2);
  const body: Record<string, unknown> = {
    amount: { currency: "EUR", value },
    description: params.description,
    redirectUrl: params.redirectUrl,
    webhookUrl: params.webhookUrl,
    metadata: params.metadata,
  };
  if (params.method) {
    body.method = params.method;
  }

  const res = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: {
      Authorization: authHeader(params.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as MolliePaymentResource & {
    title?: string;
    detail?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: json.detail ?? json.title ?? `mollie_http_${res.status}`,
    };
  }

  const checkoutUrl =
    json._links?.checkout?.href ?? json.checkoutUrl ?? null;

  return {
    ok: true,
    payment: { ...json, checkoutUrl },
  };
}

export async function mollieGetPayment(params: {
  apiKey: string;
  molliePaymentId: string;
}): Promise<
  | { ok: true; payment: MolliePaymentResource }
  | { ok: false; error: string }
> {
  const res = await fetch(
    `https://api.mollie.com/v2/payments/${encodeURIComponent(params.molliePaymentId)}`,
    {
      headers: { Authorization: authHeader(params.apiKey) },
    },
  );

  const json = (await res.json().catch(() => ({}))) as MolliePaymentResource & {
    title?: string;
    detail?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: json.detail ?? json.title ?? `mollie_http_${res.status}`,
    };
  }

  return { ok: true, payment: json };
}

export async function mollieGetOrganization(params: {
  apiKey: string;
}): Promise<{ id: string; name: string } | null> {
  const res = await fetch("https://api.mollie.com/v2/organizations/me", {
    headers: { Authorization: authHeader(params.apiKey) },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string; name?: string };
  if (!json.id) return null;
  return { id: json.id, name: json.name ?? json.id };
}
