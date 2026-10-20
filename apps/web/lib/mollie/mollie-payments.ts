import "server-only";

import type { MollieAmount } from "@/lib/mollie/mollie-amount";
import { mollieFetchJson, type MollieAuth } from "@/lib/mollie/mollie-http";

export type MolliePayment = {
  resource?: string;
  id: string;
  mode?: string;
  status: string;
  amount: MollieAmount;
  description?: string;
  method?: string | null;
  customerId?: string | null;
  mandateId?: string | null;
  subscriptionId?: string | null;
  sequenceType?: string | null;
  profileId?: string | null;
  metadata?: Record<string, string> | null;
  paidAt?: string | null;
  _links?: {
    checkout?: { href?: string };
    changePaymentState?: { href?: string };
  };
};

export type MollieCustomer = {
  id: string;
  name?: string | null;
  email?: string | null;
  metadata?: Record<string, string> | null;
};

export type MollieSubscription = {
  id: string;
  customerId?: string;
  status: string;
  amount: MollieAmount;
  interval: string;
  description?: string;
  nextPaymentDate?: string | null;
  createdAt?: string;
  canceledAt?: string | null;
  metadata?: Record<string, string> | null;
  mandateId?: string | null;
};

export type MollieTerminal = {
  id: string;
  status?: string;
  brand?: string;
  model?: string;
  description?: string | null;
  profileId?: string | null;
};

export type MolliePaymentLink = {
  id: string;
  status?: string;
  amount: MollieAmount;
  description?: string;
  _links?: {
    paymentLink?: { href?: string };
  };
};

export async function mollieCreateCustomer(
  auth: MollieAuth,
  input: { name: string; email?: string | null; metadata?: Record<string, string> },
) {
  return mollieFetchJson<MollieCustomer>({
    auth,
    method: "POST",
    path: "/customers",
    body: {
      name: input.name,
      ...(input.email ? { email: input.email } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}

export async function mollieGetCustomer(auth: MollieAuth, customerId: string) {
  return mollieFetchJson<MollieCustomer>({
    auth,
    method: "GET",
    path: `/customers/${encodeURIComponent(customerId)}`,
  });
}

export async function mollieCreatePayment(
  auth: MollieAuth,
  body: Record<string, unknown>,
) {
  return mollieFetchJson<MolliePayment>({
    auth,
    method: "POST",
    path: "/payments",
    body,
  });
}

export async function mollieGetPayment(auth: MollieAuth, paymentId: string) {
  return mollieFetchJson<MolliePayment>({
    auth,
    method: "GET",
    path: `/payments/${encodeURIComponent(paymentId)}`,
  });
}

export async function mollieCreateSubscription(
  auth: MollieAuth,
  customerId: string,
  body: Record<string, unknown>,
) {
  return mollieFetchJson<MollieSubscription>({
    auth,
    method: "POST",
    path: `/customers/${encodeURIComponent(customerId)}/subscriptions`,
    body,
  });
}

export async function mollieGetSubscription(
  auth: MollieAuth,
  customerId: string,
  subscriptionId: string,
) {
  return mollieFetchJson<MollieSubscription>({
    auth,
    method: "GET",
    path: `/customers/${encodeURIComponent(customerId)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
  });
}

export async function mollieUpdateSubscription(
  auth: MollieAuth,
  customerId: string,
  subscriptionId: string,
  body: Record<string, unknown>,
) {
  return mollieFetchJson<MollieSubscription>({
    auth,
    method: "PATCH",
    path: `/customers/${encodeURIComponent(customerId)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    body,
  });
}

export async function mollieCancelSubscription(
  auth: MollieAuth,
  customerId: string,
  subscriptionId: string,
) {
  return mollieFetchJson<MollieSubscription>({
    auth,
    method: "DELETE",
    path: `/customers/${encodeURIComponent(customerId)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
  });
}

export async function mollieListTerminals(auth: MollieAuth) {
  return mollieFetchJson<{
    _embedded?: { terminals?: MollieTerminal[] };
  }>({
    auth,
    method: "GET",
    path: "/terminals?limit=250",
  });
}

export async function mollieCreatePaymentLink(
  auth: MollieAuth,
  body: Record<string, unknown>,
) {
  return mollieFetchJson<MolliePaymentLink>({
    auth,
    method: "POST",
    path: "/payment-links",
    body,
  });
}

export function mapMollieSubscriptionStatus(status: string): string {
  switch (status) {
    case "active":
    case "pending":
    case "suspended":
    case "canceled":
    case "completed":
      if (status === "pending") return "incomplete";
      if (status === "suspended") return "past_due";
      if (status === "completed") return "canceled";
      return status;
    default:
      return status;
  }
}

export function mapMolliePaymentStatusToGuest(
  status: string,
): "open" | "pending" | "paid" | "authorized" | "failed" | "canceled" | "expired" {
  switch (status) {
    case "paid":
      return "paid";
    case "authorized":
      return "authorized";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    case "open":
    case "pending":
      return status;
    default:
      return "pending";
  }
}
