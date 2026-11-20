import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database/database.module.js";

/** One database probe serves every readiness call within this window. */
const READY_CACHE_MS = 1000;

@Controller("health")
export default class HealthController {
  private probe?: { at: number; ready: Promise<boolean> };
  constructor(private readonly database: DatabaseService) {}

  @Get()
  check() {
    return { status: "ok", service: "sahsah-backend" };
  }

  /** Public and unauthenticated, so callers share one probe instead of each taking a pool connection. */
  @Get("ready")
  async ready() {
    const now = Date.now();
    if (!this.probe || now - this.probe.at >= READY_CACHE_MS)
      this.probe = { at: now, ready: this.database.ready() };
    if (!await this.probe.ready) throw new ServiceUnavailableException("Database unavailable.");
    return { status: "ok", database: "ready" };
  }
}
