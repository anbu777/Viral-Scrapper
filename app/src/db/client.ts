import { existsSync, mkdirSync } from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getSqlitePath } from "@/lib/env";
import * as schema from "./schema";

let sqlite: Database.Database | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getRawDb() {
  if (!sqlite) {
    const dbPath = getSqlitePath();
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }
  return sqlite;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getRawDb(), { schema });
  }
  return dbInstance;
}

export function closeDbForTests() {
  dbInstance = null;
  sqlite?.close();
  sqlite = null;
}
