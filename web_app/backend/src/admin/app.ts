import AdminJS, { Router as AdminJSRouter } from "adminjs";
import AdminJSExpress from "@adminjs/express";
import express, { type ErrorRequestHandler } from "express";
import os from "node:os";
import path from "node:path";
import { DatabaseConnection } from "../database/connection.js";
import { edgeProtection } from "../gameplay/platform/http.js";
import { errorStack, log } from "../gameplay/platform/logging.js";
import { components, componentLoader } from "./components.js";
import { readAdminConfig } from "./config.js";
import { dashboardHandler } from "./home/dashboard.js";
import { HomeStats } from "./home/stats.js";
import { buildPages } from "./pages.js";
import { SESSION_LIFETIME_MS, StaffSessionStore } from "./session-store.js";
import { ContentService } from "./content/service.js";
import { CommerceService } from "./commerce/service.js";
import { createMailer } from "./messages/mailer.js";
import { MessagesService } from "./messages/service.js";
import { PublicSiteService } from "./public-site/service.js";
import { PlayersService } from "./players/service.js";
import { createAdminMedia } from "./content/storage.js";
import { ImportService } from "./content/import-service.js";
import { ZIP_LIMITS } from "./content/zip.js";
import { StaffError, StaffService } from "./staff-service.js";

export const ROOT_PATH = "/admin";
const STYLES_PATH = "/sahsah.css";
// Narrower screens (phones, portrait tablets) see a "not supported" notice instead of the dashboard.
const MIN_SCREEN_WIDTH = 1024;
// The largest multipart upload: a bulk-import ZIP. Every other upload checks its own smaller limit before reading.
const UPLOAD_LIMIT_BYTES = ZIP_LIMITS.zipBytes;

// Sahsah colours: forest green chrome, gold accent, red for errors, cream surfaces.
const theme = {
  colors: {
    primary100: "#0d2e1d",
    primary80: "#1b4a31",
    primary60: "#2f6a49",
    primary40: "#7aa28b",
    primary20: "#d3e2d9",
    accent: "#e7a72b",
    error: "#d9342b",
    bg: "#f6f1e6",
    sidebar: "#fbf8f0",
    filterBg: "#0d2e1d",
    hoverBg: "#efe7d3",
  },
};

/**
 * The staff dashboard as its own Express app, separate from the gameplay API process. AdminJS
 * (and its body handling) stays first, before anything that could parse bodies.
 */
export async function createAdminApplication(env: NodeJS.ProcessEnv = process.env) {
  const config = readAdminConfig(env);
  const database = new DatabaseConnection(config.database, () => log.error("admin.database", { code: "IDLE_CONNECTION_FAILED" }));
  try {
    await database.initialize();
    const staff = new StaffService(database);
    const media = createAdminMedia(env);
    const content = new ContentService(database, media);
    const imports = new ImportService(database, content, media, { secret: config.sessionSecret, dir: env.ADMIN_IMPORT_DIR, ttlMs: env.ADMIN_IMPORT_TTL_MS ? Number(env.ADMIN_IMPORT_TTL_MS) : undefined, previewPath: `${ROOT_PATH}/import-preview` });
    const players = new PlayersService(database, config.bulkGrantChunkSize);
    const commerce = new CommerceService(database);
    const messages = new MessagesService(database, createMailer(env));
    const publicSite = new PublicSiteService(database, media, config.cloudflareAnalyticsUrl);
    // Home figures: cached for two minutes, dropped after every committed admin change.
    const stats = new HomeStats(() => database.db, config.cloudflareAnalyticsUrl);
    database.onCommit = () => stats.invalidate();
    // First boot only: with no staff account the environment creates the first Super Admin.
    if (await staff.bootstrap(config.bootstrapEmail, config.bootstrapPassword)) log.info("admin.bootstrap", { outcome: "super_admin_created" });

    const app = express();
    app.disable("x-powered-by");
    if (config.trustedProxyHops) app.set("trust proxy", config.trustedProxyHops);
    app.use(edgeProtection(env));
    app.get("/health", async (_req, res) => {
      const ready = await database.ready();
      res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "unavailable", service: "sahsah-admin" });
    });
    // Development storage only: the local media directory, private files behind a short signature.
    if (media?.serve) app.use("/dev-media", media.serve);
    // Staged import files behind a signed, expiring link made for the dry-run report.
    app.get(`${ROOT_PATH}/import-preview/:id`, imports.preview);
    app.get("/", (_req, res) => res.redirect(302, ROOT_PATH));
    // Page responses can carry a one-time temporary password.
    app.use(`${ROOT_PATH}/api`, (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    });

    const admin = new AdminJS({
      rootPath: ROOT_PATH,
      resources: [],
      componentLoader,
      dashboard: { component: components.Home, handler: dashboardHandler(staff, stats) },
      pages: buildPages(staff, () => database.db, content, imports, players, commerce, messages, publicSite, components),
      branding: { companyName: "Sahsah Admin", logo: false, withMadeWithLove: false, theme },
      assets: { styles: [`${ROOT_PATH}${STYLES_PATH}`] },
      locale: {
        language: "en",
        availableLanguages: ["en"],
        translations: {
          en: {
            messages: { tooManyRequests: "Too many sign-in attempts. Wait a minute before trying again." },
            components: {
              Login: {
                welcomeHeader: "Sahsah staff dashboard",
                welcomeMessage: "Sign in with your staff account to manage Sahsah.",
              },
            },
          },
        },
      },
    });
    await admin.initialize();
    if (env.NODE_ENV === "development") await admin.watch();

    // Serve only AdminJS's declared assets; pnpm keeps the package behind a hidden directory.
    const router = express.Router();
    router.get(STYLES_PATH, (_request, response) => {
      // AdminJS renders its stock illustrations in an inner Box on the login welcome panel.
      response.type("text/css").send(`
        .login__Wrapper > section > section > section { display: none; }
        [data-css="app-content"] > section:last-child { flex-grow: 1; }
        /* The dashboard is built for desktop screens only; narrower screens get a notice instead of a broken layout. */
        @media (max-width: ${MIN_SCREEN_WIDTH - 1}px) {
          body > * { display: none !important; }
          body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; background: #f4efe3; }
          body::before {
            content: "Sahsah Admin\\A\\AThis screen size is not supported.\\AOpen the admin dashboard on a desktop or laptop screen at least ${MIN_SCREEN_WIDTH} pixels wide.";
            white-space: pre-line; max-width: 380px; text-align: center; color: #0d2e1d;
            font: 400 18px/1.5 Roboto, system-ui, sans-serif;
          }
        }
      `);
    });
    for (const asset of AdminJSRouter.assets) {
      router.get(asset.path, (_request, response, next) => {
        response.sendFile(path.resolve(asset.src), { dotfiles: "allow" }, (error) => {
          if (error) next(error);
        });
      });
    }
    app.use(ROOT_PATH, AdminJSExpress.buildAuthenticatedRouter(admin, {
      authenticate: async (email: string, password: string) => staff.authenticate(email, password) as never,
      cookieName: "sahsah_admin",
      cookiePassword: config.sessionSecret,
      // AdminJS's own per-address limit; the service adds a per-email lockout.
      maxRetries: { count: config.loginAttemptsPerMinute, duration: 60 },
    }, router, {
      secret: config.sessionSecret,
      store: new StaffSessionStore(database.db),
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", secure: config.production, path: ROOT_PATH, maxAge: SESSION_LIFETIME_MS },
    }, {
      // Uploads are staged on disk by the multipart parser and read once; the limits refuse early.
      maxFileSize: UPLOAD_LIMIT_BYTES,
      maxFields: 60,
      maxFieldsSize: 1024 * 1024,
      uploadDir: os.tmpdir(),
    }));

    const failure: ErrorRequestHandler = (error, _req, res, _next) => {
      // The multipart parser's size refusal.
      if (/maxFileSize|maxFieldsSize|maxFields/.test((error as Error)?.message ?? "")) return void res.status(413).json({ error: "file_too_large" });
      if (error instanceof StaffError) return void res.status(error.status).json({ error: error.code });
      log.error("admin.http", { code: "UNHANDLED", stack: errorStack(error) });
      res.status(500).json({ error: "internal_error" });
    };
    app.use(failure);
    return { app, database, staff, stats, close: () => database.close() };
  } catch (error) {
    await database.close();
    throw error;
  }
}
