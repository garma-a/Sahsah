\set ON_ERROR_STOP on
\if :{?database_name}
\else
  DO $$ BEGIN
    RAISE EXCEPTION 'Supply database_name, migration_role and runtime_role explicitly.' USING ERRCODE = '22023';
  END $$;
\endif
\if :{?migration_role}
\else
  DO $$ BEGIN
    RAISE EXCEPTION 'Supply migration_role explicitly.' USING ERRCODE = '22023';
  END $$;
\endif
\if :{?runtime_role}
\else
  DO $$ BEGIN
    RAISE EXCEPTION 'Supply runtime_role explicitly.' USING ERRCODE = '22023';
  END $$;
\endif

-- Administrator-only provisioning of a NEW database and NEW dedicated roles.
-- Existing names fail rather than silently reusing potentially privileged roles.
CREATE ROLE :"migration_role" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE :"runtime_role" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE DATABASE :"database_name" OWNER :"migration_role";
REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO :"migration_role", :"runtime_role";

-- Passwords/certificates are configured separately; no default credentials.
