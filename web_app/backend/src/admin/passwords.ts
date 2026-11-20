import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt N=2^15, r=8, p=1 needs about 32 MB; Node's default limit is exactly that, so raise it.
const COST = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer, cost = COST) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, cost, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

/** Stored form: scrypt$N$r$p$salt$hash (base64url), so the cost can change without a migration. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), {
    N: Number(n), r: Number(r), p: Number(p), maxmem: COST.maxmem,
  }).catch(() => undefined);
  return key !== undefined && key.length === expected.length && timingSafeEqual(key, expected);
}

let decoy: Promise<string> | undefined;
/** Spend the same time on an unknown email as on a wrong password. */
export async function verifyAgainstDecoy(password: string) {
  decoy ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await decoy);
}

/** A random temporary password, shown once to the Super Admin who created or reset the account. */
export function temporaryPassword() {
  return randomBytes(15).toString("base64url");
}

export const MINIMUM_PASSWORD_LENGTH = 12;
