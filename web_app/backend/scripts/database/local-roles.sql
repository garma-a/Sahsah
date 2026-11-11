-- Runs once when the local Docker database is first created (docker-compose.yml).
-- Mirrors provision.sql's separate migration and runtime roles with local-only passwords.
CREATE ROLE sahsah_owner LOGIN PASSWORD 'sahsah_local' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE sahsah_app LOGIN PASSWORD 'sahsah_local' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER DATABASE sahsah OWNER TO sahsah_owner;
REVOKE ALL ON DATABASE sahsah FROM PUBLIC;
GRANT CONNECT ON DATABASE sahsah TO sahsah_app;
