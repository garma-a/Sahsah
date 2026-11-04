import { Client } from "pg";
import { databaseUrl } from "./config.js";
import { applyMigrations, migrationStatus } from "./migrations.js";
import { grantRuntime } from "./permissions.js";

async function main() {
  const command = process.argv[2];
  if (!["migrate", "status", "grant-runtime"].includes(command)) throw new Error("Use migrate, status or grant-runtime.");
  const client = new Client({
    connectionString: databaseUrl(process.env.MIGRATION_DATABASE_URL, "MIGRATION_DATABASE_URL"),
    connectionTimeoutMillis: 5000,
    statement_timeout: 120000,
    lock_timeout: 10000,
    application_name: "sahsah-migrations",
    options: "-c timezone=UTC -c search_path=public",
  });
  try {
    await client.connect();
    if (command === "grant-runtime") {
      await grantRuntime(client, process.env.DATABASE_RUNTIME_ROLE ?? "");
      console.log("Runtime privileges configured.");
    } else {
      console.log(JSON.stringify(command === "migrate" ? await applyMigrations(client) : await migrationStatus(client), null, 2));
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Database command failed.";
  const safe = /^(Use |Supply |Runtime role|Applied migrations|Invalid migration|MIGRATION_DATABASE_URL)/.test(message);
  console.error(safe ? message : "Database command failed. Check credentials, migration history and PostgreSQL logs.");
  process.exitCode = 1;
});
