import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      ok: true,
      service: "pos-api",
      phase: 2,
      ts: new Date().toISOString(),
    };
  }
}
