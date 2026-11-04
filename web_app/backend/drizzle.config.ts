import { defineConfig } from "drizzle-kit";

// Generate/review files offline. Applying migrations uses the guarded db:migrate command.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema/index.ts",
  out: "./drizzle",
  strict: true,
});
