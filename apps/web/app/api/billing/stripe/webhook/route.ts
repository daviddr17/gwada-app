import { syncStripeInvoiceToDb, stripeInvoiceSubscriptionId } from "@/lib/billing/sync-stripe-invoice";
import { syncStripeSubscriptionToDb } from "@/lib/billing/sync-stripe-subscription";
import { stampRestaurantPastDueSince } from "@/lib/billing/subscription-db";
import { isStripeSubscriptionInvoice } from "@/lib/billing/past-due-grace";
import { createStripeClient } from "@/lib/billing/stripe-server";
import type { PlatformStripeConfig } from "@/lib/integrations/platform-stripe-config";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

const SUB_EXPAND = ["items.data.price", "latest_invoice"] as const;

async function syncSubscriptionById(
  stripe: Stripe,
  config: PlatformStripeConfig,
  subscriptionId: string,
  restaurantIdHint?: string | null,
): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: [...SUB_EXPAND],
  });
  const result = await syncStripeSubscriptionToDb(
    config,
    sub,
    restaurantIdHint,
  );
  if (!result.ok) {
    console.warn("stripe subscription sync", subscriptionId, result.error);
  }
}

async function syncSubscriptionFromInvoice(
  stripe: Stripe,
  config: PlatformStripeConfig,
  invoice: Stripe.Invoice,
  restaurantIdHint?: string | null,
): Promise<void> {
  const subscriptionId = stripeInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  await syncSubscriptionById(stripe, config, subscriptionId, restaurantIdHint);
}

export async function POST(req: Request) {
  const client = await createStripeClient();
  if (!client) {
    return Response.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const { stripe, config } = client;
  const webhookSecret = config.webhook_secret?.trim();
  if (!webhookSecret) {
    return Response.json({ error: "webhook_secret_missing" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.warn(
      "stripe webhook signature",
      err instanceof Error ? err.message : err,
    );
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const restaurantId =
          session.metadata?.restaurant_id ??
          session.client_reference_id ??
          null;
        await syncSubscriptionById(stripe, config, subId, restaurantId);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const payload = event.data.object as Stripe.Subscription;
        await syncSubscriptionById(stripe, config, payload.id);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await syncStripeSubscriptionToDb(config, sub);
        if (!result.ok) {
          console.warn(event.type, "sync", result.error);
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const result = await syncStripeInvoiceToDb(invoice);
        if (!result.ok) {
          console.warn(event.type, "invoice sync", result.error);
        }
        await syncSubscriptionFromInvoice(
          stripe,
          config,
          invoice,
          result.ok ? result.restaurantId : null,
        );
        break;
      }
      case "invoice.finalized":
      case "invoice.updated":
      case "invoice.voided": {
        const invoice = event.data.object as Stripe.Invoice;
        const result = await syncStripeInvoiceToDb(invoice);
        if (!result.ok) {
          console.warn(event.type, "invoice sync", result.error);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const result = await syncStripeInvoiceToDb(invoice, {
          eventHint: "payment_failed",
        });
        if (!result.ok) {
          console.warn(event.type, "invoice sync", result.error);
        }
        const restaurantId = result.ok ? result.restaurantId : null;
        await syncSubscriptionFromInvoice(
          stripe,
          config,
          invoice,
          restaurantId,
        );
        const alreadyPaid =
          invoice.status === "paid" || invoice.status === "void";
        if (
          !alreadyPaid &&
          restaurantId &&
          isStripeSubscriptionInvoice({
            subscriptionId: stripeInvoiceSubscriptionId(invoice),
            amountDue: invoice.amount_due ?? 0,
          })
        ) {
          await stampRestaurantPastDueSince(restaurantId);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(
      "stripe webhook handler",
      event.type,
      err instanceof Error ? err.message : err,
    );
    return Response.json({ error: "handler_failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
