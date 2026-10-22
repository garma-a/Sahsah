import { Controller, Get } from "@nestjs/common";

@Controller("health")
export default class HealthController {
  @Get()
  check() {
    return { status: "ok", service: "sahsah-backend" };
  }
}
