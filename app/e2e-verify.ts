/**
 * End-to-end verification script.
 * Tests core functionality after the major refactor.
 */

import Database from "better-sqlite3";
const db = new Database("../data/app.db");

console.log("=".repeat(60));
console.log("  END-TO-END VERIFICATION");
console.log("=".repeat(60));

// 1. Verify all new tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
const tableNames = tables.map((t) => t.name);
const requiredTables = [
  "creators", "configs", "videos", "scrape_runs", "scrape_run_items",
  "analysis_runs", "scripts", "avatars", "generation_jobs", "provider_logs",
  "quality_scores", "app_settings",
  // New tables from Wave 5+7
  "creator_groups", "scheduler_jobs", "viral_alerts", "scheduler_runs",
  // New tables from Wave 9+10
  "content_calendar", "posted_content", "intelligence_reports",
];
console.log("\n[1] Database Schema");
let allPresent = true;
for (const required of requiredTables) {
  const present = tableNames.includes(required);
  console.log(`    ${present ? "✓" : "✗"} ${required}`);
  if (!present) allPresent = false;
}
console.log(allPresent ? "    → All tables present" : "    → MISSING TABLES!");

// 2. Verify new columns
console.log("\n[2] Schema Migrations");
const creatorCols = db.prepare("PRAGMA table_info(creators)").all() as { name: string }[];
const creatorColNames = new Set(creatorCols.map((c) => c.name));
const requiredCreatorCols = ["aliases", "group_id"];
for (const col of requiredCreatorCols) {
  const present = creatorColNames.has(col);
  console.log(`    ${present ? "✓" : "✗"} creators.${col}`);
}

// 3. Data integrity
console.log("\n[3] Data Integrity");
const creatorCount = (db.prepare("SELECT COUNT(*) as c FROM creators").get() as { c: number }).c;
const configCount = (db.prepare("SELECT COUNT(*) as c FROM configs").get() as { c: number }).c;
const videoCount = (db.prepare("SELECT COUNT(*) as c FROM videos").get() as { c: number }).c;
const scriptCount = (db.prepare("SELECT COUNT(*) as c FROM scripts").get() as { c: number }).c;
const settingsCount = (db.prepare("SELECT COUNT(*) as c FROM app_settings").get() as { c: number }).c;
console.log(`    Creators: ${creatorCount}`);
console.log(`    Configs: ${configCount}`);
console.log(`    Videos: ${videoCount}`);
console.log(`    Scripts: ${scriptCount}`);
console.log(`    App Settings: ${settingsCount} (will be populated via Settings UI)`);

// 4. Config-creator alignment check
console.log("\n[4] Config-Creator Alignment");
const configs = db.prepare("SELECT config_name, creators_category FROM configs").all() as Array<{ config_name: string; creators_category: string }>;
const creators = db.prepare("SELECT username, category, platform FROM creators").all() as Array<{ username: string; category: string; platform: string }>;
let alignedConfigs = 0;
for (const config of configs) {
  const matches = creators.filter((c) => c.category.toLowerCase() === config.creators_category.toLowerCase());
  if (matches.length > 0) {
    alignedConfigs += 1;
    console.log(`    ✓ "${config.config_name}" → ${matches.length} creator(s) match`);
  } else {
    console.log(`    ⚠ "${config.config_name}" (${config.creators_category}) — NO MATCH`);
  }
}
console.log(`    → ${alignedConfigs}/${configs.length} configs have matching creators`);

// 5. Stuck/failed runs cleanup
console.log("\n[5] Run Status");
const runs = db.prepare("SELECT status, COUNT(*) as c FROM scrape_runs GROUP BY status").all() as Array<{ status: string; c: number }>;
for (const r of runs) console.log(`    ${r.status}: ${r.c}`);
const stuckRunning = (db.prepare("SELECT COUNT(*) as c FROM scrape_runs WHERE status='running'").get() as { c: number }).c;
if (stuckRunning > 0) {
  console.log(`    ⚠ ${stuckRunning} run(s) stuck in 'running' state`);
}

// 6. Viral alerts
console.log("\n[6] Viral Alerts");
const alertCount = (db.prepare("SELECT COUNT(*) as c FROM viral_alerts").get() as { c: number }).c;
const unseenCount = (db.prepare("SELECT COUNT(*) as c FROM viral_alerts WHERE seen=0 AND dismissed=0").get() as { c: number }).c;
console.log(`    Total: ${alertCount}, Unseen: ${unseenCount}`);

// 7. Scheduler jobs
console.log("\n[7] Scheduler Jobs");
const jobCount = (db.prepare("SELECT COUNT(*) as c FROM scheduler_jobs").get() as { c: number }).c;
const enabledJobs = (db.prepare("SELECT COUNT(*) as c FROM scheduler_jobs WHERE enabled=1").get() as { c: number }).c;
console.log(`    Total: ${jobCount}, Enabled: ${enabledJobs}`);

// 8. Wave 9+10 verification
console.log("\n[8] Phase 3 Tables (Calendar, Performance, Reports)");
const calendarCount = (db.prepare("SELECT COUNT(*) as c FROM content_calendar").get() as { c: number }).c;
const postedCount = (db.prepare("SELECT COUNT(*) as c FROM posted_content").get() as { c: number }).c;
const reportCount = (db.prepare("SELECT COUNT(*) as c FROM intelligence_reports").get() as { c: number }).c;
console.log(`    Calendar entries: ${calendarCount}`);
console.log(`    Posted content tracked: ${postedCount}`);
console.log(`    Intelligence reports: ${reportCount}`);

// 9. Script versioning columns
console.log("\n[9] Script Versioning Columns");
const scriptCols = db.prepare("PRAGMA table_info(scripts)").all() as { name: string }[];
const scriptColNames = new Set(scriptCols.map((c) => c.name));
const requiredScriptCols = ["parent_script_id", "version", "ab_group", "performance_views", "performance_tracked_at"];
for (const col of requiredScriptCols) {
  const present = scriptColNames.has(col);
  console.log(`    ${present ? "✓" : "✗"} scripts.${col}`);
}

console.log("\n" + "=".repeat(60));
console.log("  ✓ VERIFICATION COMPLETE");
console.log("=".repeat(60));
db.close();
