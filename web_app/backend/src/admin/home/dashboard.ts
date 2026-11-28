import type { PageHandler } from "adminjs";
import type { StaffService } from "../staff-service.js";
import { StaffError } from "../staff-service.js";
import type { HomeStats } from "./stats.js";

/** The Home figures for any signed-in staff member; `?refresh=1` bypasses the two-minute cache. */
export function dashboardHandler(staff: StaffService, stats: HomeStats): PageHandler {
  return async (request, response, context) => {
    try {
      await staff.requireStaff((context as { currentAdmin?: { id?: string } }).currentAdmin?.id);
      const query = (request as unknown as { query?: Record<string, unknown> }).query ?? {};
      return await stats.get({ refresh: query.refresh === "1" });
    } catch (error) {
      if (error instanceof StaffError) {
        (response as unknown as { status: (code: number) => unknown }).status(error.status);
        return { error: error.code };
      }
      throw error;
    }
  };
}
