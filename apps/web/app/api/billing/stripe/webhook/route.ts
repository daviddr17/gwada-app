import { syncStripeInvoiceToDb } from "@/lib/billing/sync-stripe-invoice";
import { syncStripeSubscriptionToDb } from "@/lib/billing/sync-stripe-subscription";
import { createStripeClient } from "@/lib/billing/stripe-server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

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
        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["items.data.price"],
        });
        const restaurantId =
          session.metadata?.restaurant_id ??
          session.client_reference_id ??
          null;
        const result = await syncStripeSubscriptionToDb(
          config,
          sub,
          restaurantId,
        );
        if (!result.ok) {
          console.warn("checkout.session.completed sync", result.error);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await syncStripeSubscriptionToDb(config, sub);
        if (!result.ok) {
          console.warn(event.type, "sync", result.error);
        }
        break;
      }
      case "invoice.paid":
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
