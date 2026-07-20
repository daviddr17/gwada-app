import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { CatalogController } from "./catalog/catalog.controller";
import { BrandingController } from "./branding/branding.controller";
import { SupabaseAdminService } from "./supabase-admin.service";
import { PosAuthGuard } from "./auth/pos-auth.guard";
import {
  RegisterGateService,
  SessionsService,
} from "./sessions/sessions.service";
import {
  FloorController,
  SessionsController,
} from "./sessions/sessions.controller";
import { OrdersService, PaymentsService } from "./orders/orders.service";
import {
  OrdersController,
  PaymentsController,
} from "./orders/orders.controller";
import { SyncService } from "./sync/sync.service";
import { SyncController } from "./sync/sync.controller";
import { ShiftsService } from "./shifts/shifts.service";
import { ShiftsController } from "./shifts/shifts.controller";

@Module({
  controllers: [
    HealthController,
    CatalogController,
    BrandingController,
    SessionsController,
    FloorController,
    OrdersController,
    PaymentsController,
    SyncController,
    ShiftsController,
  ],
  providers: [
    SupabaseAdminService,
    PosAuthGuard,
    RegisterGateService,
    SessionsService,
    OrdersService,
    PaymentsService,
    SyncService,
    ShiftsService,
  ],
})
export class AppModule {}
