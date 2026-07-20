import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      ok: true,
      service: "pos-api",
      phase: 1,
      ts: new Date().toISOString(),
    };
  }
}
