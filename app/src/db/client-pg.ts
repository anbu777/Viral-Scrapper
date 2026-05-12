import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getEnv, isPostgresDatabaseUrl } from "@/lib/env";
import * as schema from "./schema-pg";
import { PG_STATEMENTS } from "./migrate-pg";

let sql: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let migrateDone = false;

export async function getPgDrizzle() {
  if (!isPostgresDatabaseUrl(getEnv().DATABASE_URL)) {
    throw new Error("DATABASE_URL must be a postgres:// or postgresql:// URL for Postgres mode");
  }
  if (!sql) {
    sql = postgres(getEnv().DATABASE_URL, { max: 10, prepare: false, idle_timeout: 30 });
  }
  if (!migrateDone) {
    for (const statement of PG_STATEMENTS) {
      await sql.unsafe(statement);
    }
    migrateDone = true;
  }
  if (!dbInstance) {
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

export async function closePgForTests() {
  if (sql) {
    await sql.end({ timeout: 2 });
  }
  sql = null;
  dbInstance = null;
  migrateDone = false;
}
