import type { PageHandler } from "adminjs";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import type { SahsahDatabase } from "../database/connection.js";
import { auditActions, AuditFilterError, listAudit } from "./audit.js";
import { ContentError, type ContentService } from "./content/service.js";
import type { PlayersService } from "./players/service.js";
import { StaffError, type StaffService } from "./staff-service.js";

/**
 * Sections of the navigation. Later releases replace a placeholder with the real screens; until
 * then the page says so rather than pretending to work.
 */
export const SECTIONS = [
  { name: "shop", title: "Shop", planned: "Prices, promo codes and orders" },
  { name: "messages", title: "Messages", planned: "Contact messages and replies" },
  { name: "public-site", title: "Public site", planned: "Announcements, public pages and site settings" },
] as const;

type Reply = { status: (code: number) => unknown };
type UploadedFile = { path: string; size: number };
type PageRequest = {
  method?: string;
  query?: Record<string, unknown>;
  payload?: Record<string, unknown> & { file?: UploadedFile };
  session?: { id?: string };
  sessionID?: string;
};
type Context = { currentAdmin?: { id?: string } };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const uuid = (value: unknown) => {
  const candidate = text(value);
  return /^[0-9a-f-]{36}$/.test(candidate) ? candidate : randomUUID();
};

const categoryFields = (body: Record<string, unknown>) => ({
  nameAr: body.nameAr,
  nameFranco: body.nameFranco,
  descriptionAr: body.descriptionAr,
  descriptionFranco: body.descriptionFranco,
  sectionId: body.sectionId,
});

/** The multipart middleware wrote the file to a temporary path; read it once and remove it. */
async function readUpload(file: UploadedFile) {
  try {
    return await readFile(file.path);
  } finally {
    await rm(file.path, { force: true });
  }
}

function refuse(response: Reply, error: unknown) {
  if (error instanceof StaffError) {
    response.status(error.status);
    return { error: error.code, ...(error instanceof ContentError && error.issues ? { issues: error.issues } : {}) };
  }
  if (error instanceof AuditFilterError) {
    response.status(400);
    return { error: "invalid_filter" };
  }
  throw error;
}

export function buildPages(staff: StaffService, db: () => SahsahDatabase, content: ContentService, players: PlayersService, components: { Placeholder: string; AuditLog: string; StaffPage: string; ContentPage: string; PlayersPage: string }) {
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

  const contentPage: PageHandler = async (request, response, context) => {
    const req = request as unknown as PageRequest, actorId = (context as Context).currentAdmin?.id;
    try {
      // Admins and Super Admins both manage content; the account is re-read on every call.
      await staff.requireStaff(actorId);
      if (req.method?.toUpperCase() !== "POST") {
        const query = req.query ?? {};
        switch (text(query.view) || "home") {
          case "category":
            return await content.category(query.id);
          case "pack":
            return await content.pack(query.id);
          default:
            return await content.home({ section: text(query.section), status: text(query.status), cursor: text(query.cursor) });
        }
      }
      const body = req.payload ?? {}, requestKey = uuid(body.requestKey);
      const base = { actorId: actorId!, requestKey };
      const bytes = async () => (body.file ? await readUpload(body.file) : undefined);
      switch (body.op) {
        case "section.create":
          return await content.createSection({ ...base, nameAr: body.nameAr, nameFranco: body.nameFranco });
        case "section.rename":
          return await content.renameSection({ ...base, sectionId: body.id, nameAr: body.nameAr, nameFranco: body.nameFranco });
        case "section.move":
          return await content.moveSection({ ...base, sectionId: body.id, direction: body.direction });
        case "category.create":
          return await content.createCategory({ ...base, ...categoryFields(body) });
        case "category.update":
          return await content.updateCategory({ ...base, categoryId: body.id, ...categoryFields(body) });
        case "category.move":
          return await content.moveCategory({ ...base, categoryId: body.id, direction: body.direction });
        case "category.archive":
        case "category.unarchive":
          return await content.setCategoryArchived({ ...base, categoryId: body.id, archived: body.op === "category.archive" });
        case "category.cover":
          return await content.uploadCover({ ...base, categoryId: body.id, body: await bytes() });
        case "pack.create":
          return await content.createPack({ ...base, categoryId: body.categoryId });
        case "pack.publish":
          return await content.publishPack({ ...base, packId: body.id });
        case "pack.archive":
        case "pack.unarchive":
          return await content.setPackArchived({ ...base, packId: body.id, archived: body.op === "pack.archive" });
        case "question.save":
          return await content.saveQuestion({ ...base, packId: body.packId, slot: body.slot, mode: body.mode, questionId: body.questionId, format: body.format, promptAr: body.promptAr, promptFranco: body.promptFranco, answerAr: body.answerAr, answerFranco: body.answerFranco, config: body.config, media: body.media, confirmPublicEdit: body.confirmPublicEdit });
        case "question.retire":
          return await content.retireQuestion({ ...base, packId: body.packId, slot: body.slot, questionId: body.questionId });
        case "media.upload":
          return await content.uploadQuestionMedia({ ...base, purpose: body.purpose, body: await bytes() });
        default:
          throw new StaffError("unknown_operation");
      }
    } catch (error) {
      return refuse(response as unknown as Reply, error);
    }
  };

  const playersPage: PageHandler = async (request, response, context) => {
    const req = request as unknown as PageRequest, actorId = (context as Context).currentAdmin?.id;
    try {
      // Admins and Super Admins both manage players (ADR 0008); the account is re-read on every call.
      await staff.requireStaff(actorId);
      if (req.method?.toUpperCase() !== "POST") {
        const query = req.query ?? {};
        switch (text(query.view) || "list") {
          case "account":
            return await players.account(query.id, text(query.cursor));
          case "bulk":
            return { grants: await players.recentGrants() };
          case "deletions":
            return await players.deletionRequests(text(query.cursor));
          default:
            return await players.list({ q: text(query.q), state: text(query.state), banned: text(query.banned), flagged: text(query.flagged), cursor: text(query.cursor) });
        }
      }
      const body = req.payload ?? {}, requestKey = uuid(body.requestKey);
      const base = { actorId: actorId!, requestKey };
      switch (body.op) {
        case "credit":
          return await players.credit({ ...base, accountId: body.id, quantity: body.quantity, reason: body.reason });
        case "ban":
          return await players.ban({ ...base, accountId: body.id, reason: body.reason });
        case "unban":
          return await players.unban({ ...base, accountId: body.id, reason: body.reason });
        case "flag.add":
          return await players.addFlag({ ...base, accountId: body.id, note: body.note });
        case "flag.resolve":
          return await players.resolveFlag({ ...base, flagId: body.id });
        case "bulk.preview":
          return await players.preview({ target: body.target, phones: body.phones });
        case "bulk.grant":
          return await players.bulkGrant({ ...base, target: body.target, phones: body.phones, quantity: body.quantity, reason: body.reason });
        case "bulk.resume":
          return await players.resumeGrant(body.id);
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
    content: { component: components.ContentPage, icon: "Folder", handler: contentPage },
    players: { component: components.PlayersPage, icon: "User", handler: playersPage },
    "audit-log": { component: components.AuditLog, icon: "List", handler: auditPage },
    staff: { component: components.StaffPage, icon: "Users", handler: staffPage },
  };
}
