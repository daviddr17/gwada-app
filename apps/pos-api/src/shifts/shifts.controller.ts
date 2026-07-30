import { Body, Controller, Post, UseGuards, HttpException } from "@nestjs/common";
import { PosAuth, PosAuthGuard, type PosAuthContext } from "../auth/pos-auth.guard";
import { ShiftsService } from "./shifts.service";

@Controller("v1/shifts")
@UseGuards(PosAuthGuard)
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Post("transfer")
  async transfer(
    @PosAuth() auth: PosAuthContext,
    @Body()
    body: {
      toProfileId?: string;
      sessionIds?: string[];
      toPin?: string;
    },
  ) {
    const r = await this.shifts.transferSessions({
      restaurantId: auth.restaurantId,
      fromProfileId: auth.profileId,
      toProfileId: body.toProfileId ?? "",
      sessionIds: body.sessionIds ?? [],
      toPin: body.toPin ?? "",
    });
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r;
  }
}
