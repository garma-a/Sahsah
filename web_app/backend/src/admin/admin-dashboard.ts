import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";

function matches(actual: string, expected: string) {
  return timingSafeEqual(
    createHash("sha256").update(actual).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export async function mountAdminDashboard(app: INestApplication, config: ConfigService) {
  if (config.get<string>("ADMIN_ENABLED", "false") !== "true") return;

  const email = config.get<string>("ADMIN_EMAIL", "");
  const password = config.get<string>("ADMIN_PASSWORD", "");
  const secret = config.get<string>("ADMIN_SESSION_SECRET", "");
  if (!email || password.length < 16 || secret.length < 32) {
    throw new Error("AdminJS requires ADMIN_EMAIL, ADMIN_PASSWORD (16+ characters), and ADMIN_SESSION_SECRET (32+ characters).");
  }

  const [{ default: AdminJS, Router: AdminJSRouter }, { default: AdminJSExpress }, { default: express }] =
    await Promise.all([import("adminjs"), import("@adminjs/express"), import("express")]);
  const admin = new AdminJS({
    rootPath: "/admin",
    resources: [],
    branding: { companyName: "Sahsah", withMadeWithLove: false },
  });
  await admin.initialize();

  // Serve only AdminJS's declared assets from pnpm's hidden package directory.
  const router = express.Router();
  for (const asset of AdminJSRouter.assets) {
    router.get(asset.path, (_request, response, next) => {
      response.sendFile(path.resolve(asset.src), { dotfiles: "allow" }, (error) => {
        if (error) next(error);
      });
    });
  }
  app.use(admin.options.rootPath, AdminJSExpress.buildAuthenticatedRouter(admin, {
    authenticate: async (submittedEmail: string, submittedPassword: string) => {
      if (typeof submittedEmail !== "string" || typeof submittedPassword !== "string") return null;
      const validEmail = matches(submittedEmail, email);
      const validPassword = matches(submittedPassword, password);
      return validEmail && validPassword ? { email } : null;
    },
    cookieName: "sahsah_admin",
    cookiePassword: secret,
    maxRetries: { count: 5, duration: 60 },
  }, router, {
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.get<string>("NODE_ENV") === "production",
      path: "/admin",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }));
}
