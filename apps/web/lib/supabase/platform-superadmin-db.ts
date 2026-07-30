import type {
  PlatformIntegrationConfig,
  PlatformIntegrationKey,
  PlatformIntegrationRow,
} from "@/lib/types/platform-integration";
import { integrationConfigFromJson } from "@/lib/types/platform-integration";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SuperadminUserRow = {
  profile_id: string;
  email: string | null;
  given_name: string | null;
  family_name: string | null;
  display_name: string | null;
  phone: string | null;
  locale: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  is_online: boolean;
  restaurant_count: number;
};

export type SuperadminRestaurantRow = {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  is_published: boolean;
  brand_accent_hex: string | null;
  owner_email: string | null;
  owner_display_name: string | null;
  employee_count: number;
  created_at: string;
  plan_id: string | null;
  plan_status: string | null;
  plan_source: string | null;
  plan_interval: string | null;
  has_pos_addon: boolean | null;
};

export type SuperadminSubscriptionRow = {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_slug: string;
  plan_id: string;
  interval: string;
  status: string;
  source: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  notes: string | null;
  has_pos: boolean;
  pos_status: string | null;
  pos_interval: string | null;
  created_at: string;
  updated_at: string;
};

export type SuperadminBillingInvoiceRow = {
  id: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  restaurant_slug: string | null;
  stripe_invoice_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  billing_reason: string | null;
  currency: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  stripe_created_at: string;
  synced_at: string;
};

export async function fetchIsSuperadmin(
  sb: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await sb.rpc("auth_is_superadmin");
  if (error) {
    console.warn("auth_is_superadmin", error);
    return false;
  }
  return Boolean(data);
}

export async function fetchSuperadminUsers(
  sb: SupabaseClient,
): Promise<{ rows: SuperadminUserRow[]; error: string | null }> {
  const { data, error } = await sb.rpc("superadmin_list_users");
  if (error) return { rows: [], error: error.message };
  const rows = (data ?? []) as SuperadminUserRow[];
  return { rows, error: null };
}

export type SuperadminWaitlistRow = {
  id: string;
  given_name: string;
  family_name: string;
  email: string;
  note: string | null;
  created_at: string;
};

export async function fetchSuperadminWaitlist(
  sb: SupabaseClient,
): Promise<{ rows: SuperadminWaitlistRow[]; error: string | null }> {
  const { data, error } = await sb
    .from("platform_waitlist_entries")
    .select("id, given_name, family_name, email, note, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("schema cache") ||
      msg.includes("platform_waitlist_entries") ||
      error.code === "PGRST202" ||
      error.code === "42P01"
    ) {
      return {
        rows: [],
        error:
          "Warteliste ist in der Datenbank noch nicht eingerichtet. Bitte Migration ausführen: pnpm db:tunnel:dev (Terminal 1), dann pnpm db:push (Terminal 2).",
      };
    }
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as SuperadminWaitlistRow[], error: null };
}

export async function fetchSuperadminRestaurants(
  sb: SupabaseClient,
): Promise<{ rows: SuperadminRestaurantRow[]; error: string | null }> {
  const { data, error } = await sb.rpc("superadmin_list_restaurants");
  if (error) return { rows: [], error: error.message };
  const rows = ((data ?? []) as SuperadminRestaurantRow[]).map((r) => ({
    ...r,
    has_pos_addon: Boolean(r.has_pos_addon),
    plan_id: r.plan_id ?? "free",
    plan_status: r.plan_status ?? "active",
    plan_source: r.plan_source ?? "manual",
    plan_interval: r.plan_interval ?? "month",
  }));
  return { rows, error: null };
}

export async function fetchSuperadminSubscriptions(
  sb: SupabaseClient,
): Promise<{ rows: SuperadminSubscriptionRow[]; error: string | null }> {
  const { data, error } = await sb.rpc("superadmin_list_subscriptions");
  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("schema cache") ||
      msg.includes("superadmin_list_subscriptions") ||
      error.code === "PGRST202"
    ) {
      return {
        rows: [],
        error:
          "Abonnements-RPC fehlt noch in der Datenbank. Bitte Migration pushen (pnpm db:push).",
      };
    }
    return { rows: [], error: error.message };
  }
  const rows = ((data ?? []) as SuperadminSubscriptionRow[]).map((r) => ({
    ...r,
    has_pos: Boolean(r.has_pos),
    cancel_at_period_end: Boolean(r.cancel_at_period_end),
  }));
  return { rows, error: null };
}

export async function fetchSuperadminBillingInvoices(
  sb: SupabaseClient,
): Promise<{ rows: SuperadminBillingInvoiceRow[]; error: string | null }> {
  const { data, error } = await sb
    .from("restaurant_billing_invoices")
    .select(
      "id, restaurant_id, stripe_invoice_id, stripe_customer_id, stripe_subscription_id, status, billing_reason, currency, amount_due, amount_paid, amount_remaining, period_start, period_end, paid_at, hosted_invoice_url, invoice_pdf, stripe_created_at, synced_at, restaurants(name, slug)",
    )
    .order("stripe_created_at", { ascending: false })
    .limit(500);

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("schema cache") ||
      msg.includes("restaurant_billing_invoices") ||
      error.code === "PGRST202" ||
      error.code === "42P01"
    ) {
      return {
        rows: [],
        error:
          "Rechnungs-Tabelle fehlt noch. Bitte Migration pushen (pnpm db:push).",
      };
    }
    return { rows: [], error: error.message };
  }

  const rows: SuperadminBillingInvoiceRow[] = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const restaurant = r.restaurants as
      | { name?: string; slug?: string }
      | null
      | undefined;
    return {
      id: String(r.id),
      restaurant_id: (r.restaurant_id as string | null) ?? null,
      restaurant_name: restaurant?.name ?? null,
      restaurant_slug: restaurant?.slug ?? null,
      stripe_invoice_id: String(r.stripe_invoice_id),
      stripe_customer_id: (r.stripe_customer_id as string | null) ?? null,
      stripe_subscription_id:
        (r.stripe_subscription_id as string | null) ?? null,
      status: String(r.status),
      billing_reason: (r.billing_reason as string | null) ?? null,
      currency: String(r.currency ?? "eur"),
      amount_due: Number(r.amount_due ?? 0),
      amount_paid: Number(r.amount_paid ?? 0),
      amount_remaining: Number(r.amount_remaining ?? 0),
      period_start: (r.period_start as string | null) ?? null,
      period_end: (r.period_end as string | null) ?? null,
      paid_at: (r.paid_at as string | null) ?? null,
      hosted_invoice_url: (r.hosted_invoice_url as string | null) ?? null,
      invoice_pdf: (r.invoice_pdf as string | null) ?? null,
      stripe_created_at: String(r.stripe_created_at),
      synced_at: String(r.synced_at),
    };
  });

  return { rows, error: null };
}

export async function fetchPlatformIntegrations(
  sb: SupabaseClient,
): Promise<{ rows: PlatformIntegrationRow[]; error: string | null }> {
  const { data, error } = await sb
    .from("platform_integrations")
    .select("key, enabled, config, updated_at")
    .order("key");
  if (error) return { rows: [], error: error.message };
  const rows: PlatformIntegrationRow[] = (data ?? []).map((r) => ({
    key: r.key as PlatformIntegrationKey,
    enabled: Boolean(r.enabled),
    config: integrationConfigFromJson(r.config),
    updated_at: r.updated_at as string,
  }));
  return { rows, error: null };
}

export async function upsertPlatformIntegration(
  sb: SupabaseClient,
  key: PlatformIntegrationKey,
  enabled: boolean,
  config: PlatformIntegrationConfig,
): Promise<{ error: string | null }> {
  const { error } = await sb.from("platform_integrations").upsert({
    key,
    enabled,
    config,
  });
  return { error: error?.message ?? null };
}
