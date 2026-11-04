import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database/database.module.js";

@Controller("health")
export default class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  check() {
    return { status: "ok", service: "sahsah-backend" };
  }

  @Get("ready")
  async ready() {
    if (!await this.database.ready()) throw new ServiceUnavailableException("Database unavailable.");
    return { status: "ok", database: "ready" };
  }
}
