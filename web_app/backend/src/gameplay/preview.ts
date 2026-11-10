import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { PreviewOptions, VerifiedAccount } from "./ports.js";
import { requireState } from "./problem.js";

// Preview mode (ADR 0017) lets a browser that knows the shared passcode obtain
// its own host account before login exists. It is never combined with real
// accounts, and its database is discarded before launch.
const issuer = "sahsah-preview",
  lifetimeMs = 30 * 86400000;

export function previewMode(
  env: NodeJS.ProcessEnv,
): PreviewOptions | undefined {
  if (!env.GAMEPLAY_PREVIEW_PASSCODE) return;
  requireState(
    env.GAMEPLAY_PREVIEW_PASSCODE.length >= 6 &&
      (env.GAMEPLAY_PREVIEW_SECRET ?? "").length >= 32 &&
      !env.GAMEPLAY_IDENTITY_JWKS_URL,
    "INVALID_PREVIEW_CONFIGURATION",
    500,
  );
  return {
    passcode: env.GAMEPLAY_PREVIEW_PASSCODE,
    secret: env.GAMEPLAY_PREVIEW_SECRET!,
  };
}
const key = (preview: PreviewOptions) =>
  new TextEncoder().encode(preview.secret);
export function previewIdentity(preview: PreviewOptions) {
  return async (token: string): Promise<VerifiedAccount | undefined> => {
    try {
      const { payload } = await jwtVerify(token, key(preview), {
        issuer,
        algorithms: ["HS256"],
        requiredClaims: ["exp", "account_id"],
      });
      const account = z.uuid().safeParse(payload.account_id);
      if (account.success && payload.exp)
        return { accountId: account.data, expiresAt: payload.exp * 1000 };
    } catch {
      /* An invalid preview credential never becomes an identity. */
    }
    return undefined;
  };
}

export async function previewCredential(
  preview: PreviewOptions,
  accountId: string,
) {
  const expiresAt = Date.now() + lifetimeMs;
  return {
    credential: await new SignJWT({ account_id: accountId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt / 1000))
      .sign(key(preview)),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}
