import { defineConfig } from "drizzle-kit";

/** Local SQLite schema generation. For Supabase, set DATABASE_URL=postgresql://... at runtime — DDL is applied via migrate-pg on boot. */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "../data/app.db",
  },
});
