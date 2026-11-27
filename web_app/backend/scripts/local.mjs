// Local development in one command (`pnpm local`, `pnpm local:admin`, `pnpm local:web`).
// Starts the Docker database from docker-compose.yml, builds, migrates, then runs the chosen
// processes in the foreground with prefixed output. Ctrl+C stops them all; the database keeps its data.
// Reads `.env` like every other script here. Local-only admin values it lacks are generated once.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const MODES = {
  all: ["api", "admin", "web"],
  admin: ["admin"],
  web: ["api", "web"],
};
const mode = process.argv[2] ?? "all";
const parts = MODES[mode];
if (!parts) fail(`Unknown mode "${mode}". Use one of: ${Object.keys(MODES).join(", ")}.`);

const backend = path.resolve(import.meta.dirname, "..");
const frontend = path.resolve(backend, "../frontend");
const envFile = path.join(backend, ".env");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}
function step(message) {
  console.log(`\n▶ ${message}`);
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: backend, stdio: "inherit", ...options });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed.`);
}

function readEnv() {
  if (!existsSync(envFile)) fail("web_app/backend/.env is missing. Copy .env.example to .env and set the local values (see README: Run the game locally).");
  const values = {};
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

/** The admin needs a session secret and a first account; generate local-only values once. */
function ensureAdminEnv(env) {
  const missing = {
    ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
    ADMIN_BOOTSTRAP_EMAIL: "admin@example.test",
    ADMIN_BOOTSTRAP_PASSWORD: `local-${randomBytes(9).toString("base64url")}`,
  };
  const added = Object.entries(missing).filter(([key]) => !env[key]);
  if (added.length === 0) return;
  appendFileSync(envFile, `\n# Added by pnpm local for local development\n${added.map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
  for (const [key, value] of added) env[key] = value;
  if (added.some(([key]) => key === "ADMIN_BOOTSTRAP_PASSWORD")) {
    console.log(`  First admin account (created on first start): ${env.ADMIN_BOOTSTRAP_EMAIL}; its password is ADMIN_BOOTSTRAP_PASSWORD in .env.`);
  }
}

function startDatabase() {
  if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) {
    fail("Docker is not running. Start it (Linux: sudo systemctl start docker) and run this again.");
  }
  step("Starting the local database (docker compose)");
  run("docker", ["compose", "up", "-d", "--wait"]);
}

function build() {
  step(parts.includes("admin") ? "Building the API and the admin screens" : "Building the API");
  run(pnpm, ["run", parts.includes("admin") ? "build:admin" : "build"]);
  step("Applying database migrations");
  run("node", ["--env-file=.env", "dist/database/cli.js", "migrate"], { stdio: ["ignore", "ignore", "inherit"] });
  run("node", ["--env-file=.env", "dist/database/cli.js", "grant-runtime"], { stdio: ["ignore", "ignore", "inherit"] });
}

const children = [];
function start(name, command, args, options) {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
  const prefix = `[${name}]`.padEnd(8);
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) console.log(`${prefix}${line}`);
    });
  }
  child.on("exit", (code) => {
    if (stopping) return;
    console.error(`\n✖ ${name} stopped (exit ${code}). Stopping the others.`);
    stop(code ?? 1);
  });
  children.push(child);
}

let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

const env = readEnv();
if (parts.includes("admin")) ensureAdminEnv(env);
startDatabase();
build();
if (parts.includes("web") && !existsSync(path.join(frontend, "node_modules"))) {
  step("Installing the website's packages");
  run(pnpm, ["install", "--frozen-lockfile"], { cwd: frontend });
}

step("Starting");
const urls = [];
if (parts.includes("api")) {
  start("api", "node", ["--env-file=.env", "dist/main.js"], { cwd: backend });
  urls.push(`API      http://localhost:${env.PORT || 3001}/api/health`);
}
if (parts.includes("admin")) {
  start("admin", "node", ["--env-file=.env", "dist/admin/main.js"], { cwd: backend, env: { ...process.env, NODE_ENV: "development", ADMIN_PORT: env.ADMIN_PORT || "3002" } });
  urls.push(`Admin    http://localhost:${env.ADMIN_PORT || 3002}/admin`);
}
if (parts.includes("web")) {
  start("web", pnpm, ["run", "dev"], { cwd: frontend });
  urls.push("Website  http://localhost:3000");
}
console.log(`\n${urls.map((url) => `  ${url}`).join("\n")}\n  Press Ctrl+C to stop.\n`);
