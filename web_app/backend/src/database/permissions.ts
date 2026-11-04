import type { Client } from "pg";

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function grantRuntime(client: Client, runtimeRole: string) {
  if (!runtimeRole || runtimeRole === "PUBLIC") throw new Error("Supply the dedicated runtime role name.");
  const role = await client.query<{ rolname: string; unsafe: boolean }>(`
    SELECT rolname, rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
      OR pg_has_role(oid, current_user::regrole, 'MEMBER')
      OR has_database_privilege(oid, current_database(), 'CREATE') AS unsafe
      FROM pg_roles WHERE rolname=$1
  `, [runtimeRole]);
  if (role.rows.length !== 1 || role.rows[0].unsafe) throw new Error("Runtime role must exist without administrative privileges or migration ownership.");
  const app = identifier(runtimeRole);
  await client.query("BEGIN");
  try {
    await client.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await client.query(`REVOKE CREATE ON SCHEMA public FROM ${app}`);
    await client.query(`REVOKE ALL ON SCHEMA drizzle FROM ${app}`);
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA drizzle FROM ${app}`);
    await client.query(`REVOKE ALL ON SCHEMA sahsah_internal FROM ${app}`);
    await client.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sahsah_internal FROM PUBLIC, ${app}`);
    await client.query("ALTER DEFAULT PRIVILEGES IN SCHEMA sahsah_internal REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC");
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${app}`);
    await client.query(`GRANT USAGE ON SCHEMA public, drizzle TO ${app}`);
    await client.query(`GRANT SELECT ON drizzle.__drizzle_migrations TO ${app}`);
    await client.query(`GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO ${app}`);
    const { rows: tables } = await client.query<{ table_name: string }>(`
      SELECT tablename AS table_name FROM pg_tables WHERE schemaname='public'
        AND tablename NOT IN ('accounts', 'token_ledger_entries', 'staff_audit_events')
    `);
    for (const table of tables) await client.query(`GRANT UPDATE ON public.${identifier(table.table_name)} TO ${app}`);
    const { rows: columns } = await client.query<{ column_name: string }>(`
      SELECT attname AS column_name FROM pg_attribute
        WHERE attrelid='public.accounts'::regclass AND attnum>0 AND NOT attisdropped
          AND attname NOT IN ('id', 'created_at', 'token_balance', 'token_balance_updated_at')
        ORDER BY attnum
    `);
    await client.query(`GRANT UPDATE (${columns.map((column) => identifier(column.column_name)).join(", ")}) ON public.accounts TO ${app}`);
    // PII audit cleanup can redact details; actor/action/source identity stays immutable.
    await client.query(`GRANT UPDATE (details) ON public.staff_audit_events TO ${app}`);
    await client.query(`GRANT DELETE ON public.question_media, public.game_question_media,
      public.staff_sessions, public.phone_verification_challenges, public.public_page_media,
      public.game_actions, public.outbox_events TO ${app}`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
