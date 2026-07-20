import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  HttpException,
} from "@nestjs/common";
import { PosAuth, PosAuthGuard, type PosAuthContext } from "../auth/pos-auth.guard";
import { SessionsService } from "./sessions.service";

@Controller("v1/sessions")
@UseGuards(PosAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get("floor")
  async floor(@PosAuth() auth: PosAuthContext) {
    return this.sessions.listFloor(auth.restaurantId);
  }

  @Post("open")
  async open(
    @PosAuth() auth: PosAuthContext,
    @Body()
    body: {
      diningTableId?: string;
      coverCount?: number;
      reservationId?: string | null;
    },
  ) {
    const r = await this.sessions.open({
      restaurantId: auth.restaurantId,
      diningTableId: body.diningTableId ?? "",
      coverCount: body.coverCount ?? 2,
      profileId: auth.profileId,
      reservationId: body.reservationId,
    });
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r;
  }

  @Get(":sessionId")
  async summary(
    @PosAuth() auth: PosAuthContext,
    @Param("sessionId") sessionId: string,
  ) {
    const r = await this.sessions.getSummary(auth.restaurantId, sessionId);
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r.summary;
  }

  @Post(":sessionId/bill")
  async bill(@PosAuth() auth: PosAuthContext, @Param("sessionId") sessionId: string) {
    const r = await this.sessions.setBill(auth.restaurantId, sessionId);
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r;
  }

  @Post(":sessionId/release")
  async release(
    @PosAuth() auth: PosAuthContext,
    @Param("sessionId") sessionId: string,
  ) {
    const r = await this.sessions.release({
      restaurantId: auth.restaurantId,
      sessionId,
      profileId: auth.profileId,
    });
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r;
  }

  @Post(":sessionId/move")
  async move(
    @PosAuth() auth: PosAuthContext,
    @Param("sessionId") sessionId: string,
    @Body() body: { targetDiningTableId?: string },
  ) {
    const r = await this.sessions.moveTable({
      restaurantId: auth.restaurantId,
      sessionId,
      targetDiningTableId: body.targetDiningTableId ?? "",
    });
    if (!r.ok) throw new HttpException({ error: r.error }, r.status);
    return r;
  }
}

@Controller("v1/floor")
@UseGuards(PosAuthGuard)
export class FloorController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  async floor(@PosAuth() auth: PosAuthContext, @Query("restaurantId") _rid?: string) {
    return this.sessions.listFloor(auth.restaurantId);
  }
}
