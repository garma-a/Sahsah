import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { applyMigrations } from "../../dist/database/migrations.js";
import { grantRuntime } from "../../dist/database/permissions.js";

export const exec = promisify(execFile);

export async function cluster(t) {
  if (process.getuid?.() === 0) throw new Error("Run PostgreSQL integration tests as a normal user.");
  const bin = process.env.PG_BIN ?? "/usr/lib/postgresql/18/bin";
  const root = await mkdtemp(path.join(tmpdir(), "sahsah-backend-test-"));
  const socket = path.join(root, "socket");
  const data = path.join(root, "data");
  await mkdir(socket, { mode: 0o700 });
  await writeFile(path.join(root, ".sahsah-disposable"), "private test cluster\n");
  let started = false;
  const connections = new Set();
  t.after(async () => {
    try {
      await Promise.allSettled([...connections].map((client) => client.end()));
      if (started) await exec(path.join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], { timeout: 30000 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  const { stdout } = await exec(path.join(bin, "postgres"), ["--version"]);
  if (!/PostgreSQL\) 18\./.test(stdout)) throw new Error("Use PostgreSQL 18 binaries via PG_BIN.");
  await exec(path.join(bin, "initdb"), ["-D", data, "--auth-local=trust", "--auth-host=reject", "--no-locale", "--encoding=UTF8", "-U", "sahsah_test"], { timeout: 30000 });
  await exec(path.join(bin, "pg_ctl"), ["-D", data, "-l", path.join(root, "postgres.log"), "-o",
    `-h '' -k ${socket} -c shared_buffers=64MB -c max_connections=24`, "-w", "start"], { timeout: 30000 });
  started = true;
  const connect = async (user, database) => {
    const client = new Client({ host: socket, user, database, connectionTimeoutMillis: 5000, statement_timeout: 30000, lock_timeout: 5000 });
    await client.connect();
    connections.add(client);
    client.once("end", () => connections.delete(client));
    return client;
  };
  const admin = await connect("sahsah_test", "postgres");
  try {
    await admin.query("CREATE ROLE sahsah_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
    await admin.query("CREATE ROLE sahsah_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
  } finally { await admin.end(); }
  return {
    root, socket, connect,
    url: (user = "sahsah_app", database = "sahsah_application") =>
      `postgresql://${user}@localhost/${database}?host=${encodeURIComponent(socket)}`,
    async database(name, migrate = true) {
      const admin = await connect("sahsah_test", "postgres");
      try { await admin.query(`CREATE DATABASE "${name.replaceAll('"', '""')}" OWNER sahsah_owner`); }
      finally { await admin.end(); }
      const owner = await connect("sahsah_owner", name);
      if (migrate) {
        try {
          await applyMigrations(owner);
          await grantRuntime(owner, "sahsah_app");
        } catch (error) { await owner.end(); throw error; }
      }
      return owner;
    },
  };
}
