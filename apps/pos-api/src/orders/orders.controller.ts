import { Body, Controller, Post, UseGuards, HttpException } from "@nestjs/common";
import { PosAuth, PosAuthGuard, type PosAuthContext } from "../auth/pos-auth.guard";
import { OrdersService, PaymentsService, type OrderLineInput } from "../orders/orders.service";

@Controller("v1/orders")
@UseGuards(PosAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  async create(
    @PosAuth() auth: PosAuthContext,
    @Body()
    body: {
      sessionId?: string;
      items?: OrderLineInput[];
      notes?: string;
    },
  ) {
    const r = await this.orders.createOrder({
      restaurantId: auth.restaurantId,
      sessionId: body.sessionId ?? "",
      profileId: auth.profileId,
      items: body.items ?? [],
      notes: body.notes,
    });
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r;
  }

  @Post("fire-course")
  async fire(
    @PosAuth() auth: PosAuthContext,
    @Body() body: { sessionId?: string; course?: string },
  ) {
    const r = await this.orders.fireCourse({
      restaurantId: auth.restaurantId,
      sessionId: body.sessionId ?? "",
      course: body.course ?? "main",
    });
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r;
  }
}

@Controller("v1/payments")
@UseGuards(PosAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("cash")
  async cash(
    @PosAuth() auth: PosAuthContext,
    @Body()
    body: {
      sessionId?: string;
      allocations?: Array<{ orderLineId: string; quantity: number }>;
      tipCents?: number;
      receivedAmountCents?: number | null;
      settlementMode?: "item" | "amount";
    },
  ) {
    const r = await this.payments.collectCash({
      restaurantId: auth.restaurantId,
      sessionId: body.sessionId ?? "",
      allocations: body.allocations ?? [],
      tipCents: body.tipCents,
      receivedAmountCents: body.receivedAmountCents,
      settlementMode: body.settlementMode,
    });
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r;
  }

  @Post("mollie")
  async mollie(
    @PosAuth() auth: PosAuthContext,
    @Body()
    body: {
      sessionId?: string;
      method?: "card" | "paypal";
      amountCents?: number;
      tipCents?: number;
      allocations?: Array<{ orderLineId: string; quantity: number }>;
    },
  ) {
    const r = await this.payments.createMolliePayment({
      restaurantId: auth.restaurantId,
      sessionId: body.sessionId ?? "",
      method: body.method === "paypal" ? "paypal" : "card",
      amountCents: Number(body.amountCents ?? 0),
      tipCents: body.tipCents,
      allocations: body.allocations ?? [],
    });
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r;
  }
}
