import { Body, Controller, Post, UseGuards, HttpException } from "@nestjs/common";
import { PosAuth, PosAuthGuard, type PosAuthContext } from "../auth/pos-auth.guard";
import { SyncService, type SyncEventInput } from "./sync.service";

@Controller("v1/sync")
@UseGuards(PosAuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post("events")
  async ingest(
    @PosAuth() auth: PosAuthContext,
    @Body() body: { events?: SyncEventInput[] },
  ) {
    if (!Array.isArray(body.events) || body.events.length === 0) {
      throw new HttpException({ error: "empty_events" }, 400);
    }
    return this.sync.ingest({
      restaurantId: auth.restaurantId,
      profileId: auth.profileId,
      deviceId: auth.deviceId,
      events: body.events,
    });
  }
}
