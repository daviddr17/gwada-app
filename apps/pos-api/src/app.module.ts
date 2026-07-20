import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { CatalogController } from "./catalog/catalog.controller";
import { BrandingController } from "./branding/branding.controller";
import { SupabaseAdminService } from "./supabase-admin.service";

@Module({
  controllers: [HealthController, CatalogController, BrandingController],
  providers: [SupabaseAdminService],
})
export class AppModule {}
