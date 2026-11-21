import type { PageHandler } from "adminjs";
import { randomUUID } from "node:crypto";
import type { SahsahDatabase } from "../database/connection.js";
import { auditActions, AuditFilterError, listAudit } from "./audit.js";
import { StaffError, type StaffService } from "./staff-service.js";

/**
 * Sections of the navigation. Later releases replace a placeholder with the real screens; until
 * then the page says so rather than pretending to work.
 */
export const SECTIONS = [
  { name: "content", title: "Content", planned: "Categories, packs and questions" },
  { name: "players", title: "Players", planned: "Accounts, token banks and complimentary credit" },
  { name: "shop", title: "Shop", planned: "Prices, promo codes and orders" },
  { name: "messages", title: "Messages", planned: "Contact messages and replies" },
  { name: "public-site", title: "Public site", planned: "Announcements, public pages and site settings" },
] as const;

type Reply = { status: (code: number) => unknown };
type PageRequest = {
  method?: string;
  query?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  session?: { id?: string };
  sessionID?: string;
};
type Context = { currentAdmin?: { id?: string } };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const uuid = (value: unknown) => {
  const candidate = text(value);
  return /^[0-9a-f-]{36}$/.test(candidate) ? candidate : randomUUID();
};

function refuse(response: Reply, error: unknown) {
  if (error instanceof StaffError) {
    response.status(error.status);
    return { error: error.code };
  }
  if (error instanceof AuditFilterError) {
    response.status(400);
    return { error: "invalid_filter" };
  }
  throw error;
}

export function buildPages(staff: StaffService, db: () => SahsahDatabase, components: { Placeholder: string; AuditLog: string; StaffPage: string }) {
  const placeholder = (section: (typeof SECTIONS)[number]) => ({
    component: components.Placeholder,
    icon: "Circle",
    handler: (async () => ({ title: section.title, planned: section.planned })) as PageHandler,
  });

  const staffPage: PageHandler = async (request, response, context) => {
    const req = request as unknown as PageRequest, actorId = (context as Context).currentAdmin?.id;
    try {
      // Checked against the database on every call; the sidebar entry is only a convenience.
      await staff.requireSuperAdmin(actorId);
      if (req.method?.toUpperCase() !== "POST") return { staff: await staff.list(), me: actorId };
      const body = req.payload ?? {}, requestKey = uuid(body.requestKey);
      const base = { actorId: actorId!, requestKey };
      switch (body.op) {
        case "create":
          return await staff.create({ ...base, email: body.email, role: body.role });
        case "deactivate":
        case "reactivate":
          return await staff.setActive({ ...base, targetId: body.id, active: body.op === "reactivate" });
        case "role":
          return await staff.changeRole({ ...base, targetId: body.id, role: body.role });
        case "reset-password":
          return await staff.resetPassword({ ...base, targetId: body.id, currentSessionId: req.sessionID ?? req.session?.id });
        default:
          throw new StaffError("unknown_operation");
      }
    } catch (error) {
      return refuse(response as unknown as Reply, error);
    }
  };

  const auditPage: PageHandler = async (request, response) => {
    const query = (request as unknown as PageRequest).query ?? {};
    try {
      const [page, accounts, actions] = await Promise.all([
        listAudit(db(), { staffId: text(query.staff) || undefined, action: text(query.action) || undefined, cursor: text(query.cursor) || undefined }),
        staff.list(),
        auditActions(db()),
      ]);
      return { ...page, staff: accounts.map(({ id, email }) => ({ id, email })), actions };
    } catch (error) {
      return refuse(response as unknown as Reply, error);
    }
  };

  return {
    ...Object.fromEntries(SECTIONS.map((section) => [section.name, placeholder(section)])),
    "audit-log": { component: components.AuditLog, icon: "List", handler: auditPage },
    staff: { component: components.StaffPage, icon: "Users", handler: staffPage },
  };
}
