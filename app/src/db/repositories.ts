import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { getPgDrizzle } from "./client-pg";
import { migrateDb } from "./migrate";
import * as sqlite from "./schema";
import * as pg from "./schema-pg";
import { parseJson, redactSensitive, stringifyJson } from "@/lib/json";
import { getEnv, isPostgresDatabaseUrl } from "@/lib/env";
import { cacheThumbnail } from "@/lib/thumbnail-cache";
import type {
  Config,
  Creator,
  CreatorGroup,
  PipelineParams,
  PipelineRun,
  ProviderErrorCode,
  ProviderLog,
  SchedulerJob,
  Script,
  ScrapedReel,
  Video,
  ViralAlert,
  ContentCalendarEntry,
  PostedContent,
  IntelligenceReport,
} from "@/lib/types";

function isPostgresMode() {
  return isPostgresDatabaseUrl(getEnv().DATABASE_URL);
}

function ensureSqlite() {
  migrateDb();
  return getDb();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function rowToCreator(row: {
  id: string;
  platform?: string;
  username: string;
  category: string;
  profilePicUrl: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  lastScrapedAt: string;
  aliases?: string;
  groupId?: string | null;
}): Creator {
  // Explicitly recognize valid platforms; everything else falls back to instagram
  const validPlatforms: string[] = ["tiktok", "youtube_shorts"];
  const rawPlatform = (row.platform || "").trim();
  const platform = validPlatforms.includes(rawPlatform)
    ? (rawPlatform as Creator["platform"])
    : "instagram";
  let aliases: string[] = [];
  try { aliases = row.aliases ? JSON.parse(row.aliases) : []; } catch { /* ignore */ }
  return {
    id: row.id,
    platform,
    username: row.username,
    category: row.category,
    profilePicUrl: row.profilePicUrl,
    followers: row.followers,
    reelsCount30d: row.reelsCount30d,
    avgViews30d: row.avgViews30d,
    lastScrapedAt: row.lastScrapedAt,
    aliases: aliases.length > 0 ? aliases : undefined,
    groupId: row.groupId ?? null,
  };
}

/** Normalizes a username for fuzzy matching (lowercase, strip @, dots, underscores). */
export function normalizeUsername(u: string): string {
  return u.toLowerCase().replace(/^@/, "").replace(/[._-]/g, "");
}

/** Returns all names a creator could be known by (username + aliases), normalized. */
export function creatorAllNames(creator: Creator): string[] {
  const names = [creator.username];
  if (creator.aliases) names.push(...creator.aliases);
  return [...new Set(names.map(normalizeUsername))];
}

function rowToConfig(row: {
  id: string;
  configName: string;
  creatorsCategory: string;
  analysisInstruction: string;
  newConceptsInstruction: string;
}): Config {
  return {
    id: row.id,
    configName: row.configName,
    creatorsCategory: row.creatorsCategory,
    analysisInstruction: row.analysisInstruction,
    newConceptsInstruction: row.newConceptsInstruction,
  };
}

function rowToVideo(row: {
  id: string;
  sourcePostUrl: string;
  platform: string;
  shortcode: string;
  thumbnail: string;
  creator: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  analysis: string;
  analysisJson: string;
  newConcepts: string;
  datePosted: string;
  dateAdded: string;
  configName: string;
  scrapeRunId: string | null;
  provider: string;
  starred: boolean;
  selectedForAnalysis: boolean;
  duration: number | null;
  videoFileUrl: string | null;
  transcript: string | null;
  viralityScore: number;
  rankingReason: string;
  scoreBreakdownJson: string;
  rawProviderPayloadJson: string;
  analysisStatus?: string | null;
}): Video {
  const st = row.analysisStatus ?? "";
  return {
    id: row.id,
    link: row.sourcePostUrl,
    platform: row.platform,
    shortcode: row.shortcode,
    thumbnail: row.thumbnail,
    creator: row.creator,
    caption: row.caption,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    analysis: row.analysis,
    analysisJson: parseJson(row.analysisJson, undefined),
    newConcepts: row.newConcepts,
    datePosted: row.datePosted,
    dateAdded: row.dateAdded,
    configName: row.configName,
    scrapeRunId: row.scrapeRunId ?? undefined,
    provider: row.provider,
    starred: row.starred,
    selectedForAnalysis: row.selectedForAnalysis,
    duration: row.duration ?? undefined,
    videoFileUrl: row.videoFileUrl ?? undefined,
    transcript: row.transcript ?? undefined,
    viralityScore: row.viralityScore,
    rankingReason: row.rankingReason,
    scoreBreakdown: parseJson(row.scoreBreakdownJson, {}),
    rawProviderPayload: parseJson(row.rawProviderPayloadJson, {}),
    analysisStatus: st === "ok" || st === "fallback" || st === "failed" ? st : st ? (st as Video["analysisStatus"]) : "",
  };
}

function rowToScript(row: typeof sqlite.scripts.$inferSelect | typeof pg.scripts.$inferSelect): Script {
  return {
    id: row.id,
    videoId: row.videoId,
    generationRunId: row.generationRunId,
    scriptVariant: row.scriptVariant as Script["scriptVariant"],
    videoCreator: row.videoCreator,
    videoViews: row.videoViews,
    videoLink: row.videoLink,
    title: row.title,
    hook: row.hook,
    script: row.script,
    spokenScript: row.spokenScript,
    cta: row.cta,
    sourceInspiration: row.sourceInspiration,
    similarityScore: row.similarityScore,
    qualityScore: row.qualityScore,
    platform: row.platform,
    estimatedDuration: row.estimatedDuration,
    estimatedDurationSeconds: row.estimatedDurationSeconds,
    contentType: row.contentType,
    dateGenerated: row.dateGenerated,
    starred: row.starred,
    videoJobId: row.videoJobId ?? undefined,
    videoStatus: (row.videoStatus as Script["videoStatus"]) || undefined,
    videoUrl: row.videoUrl ?? undefined,
    geminiCheck: row.geminiCheck ?? undefined,
    claudeCheck: row.claudeCheck ?? undefined,
    imagePrompt: row.imagePrompt ?? undefined,
    videoPrompt: row.videoPrompt ?? undefined,
    avatarId: row.avatarId ?? undefined,
    generatedImageUrl: row.generatedImageUrl ?? undefined,
    videoMode: (row.videoMode as Script["videoMode"]) || undefined,
    videoProvider: (row.videoProvider as Script["videoProvider"]) || undefined,
    sourceVideoUrl: row.sourceVideoUrl ?? undefined,
    parentScriptId: (row as { parentScriptId?: string | null }).parentScriptId ?? null,
    version: (row as { version?: number }).version ?? 1,
    abGroup: (row as { abGroup?: string | null }).abGroup ?? null,
    performanceViews: (row as { performanceViews?: number }).performanceViews ?? 0,
    performanceTrackedAt: (row as { performanceTrackedAt?: string | null }).performanceTrackedAt ?? null,
  };
}

function rowToRun(row: {
  id: string;
  configName: string;
  provider: string;
  status: string;
  freeMode: boolean;
  cancelRequested?: boolean | null;
  paramsJson: string;
  progressJson: string;
  errorJson: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}): PipelineRun {
  return {
    id: row.id,
    configName: row.configName,
    provider: row.provider,
    status: row.status as PipelineRun["status"],
    freeMode: row.freeMode,
    cancelRequested: Boolean(row.cancelRequested),
    params: parseJson(row.paramsJson, {} as PipelineParams),
    progress: parseJson(row.progressJson, {}),
    errors: parseJson(row.errorJson, []),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const repo = {
  creators: {
    async list(category?: string): Promise<Creator[]> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        let rows;
        if (category) {
          // Case-insensitive category matching
          rows = await db.select().from(pg.creators);
          const lowerCat = category.toLowerCase();
          rows = rows.filter((row) => row.category.toLowerCase() === lowerCat);
        } else {
          rows = await db.select().from(pg.creators);
        }
        return rows.map(rowToCreator);
      }
      const db = ensureSqlite();
      let rows;
      if (category) {
        // Case-insensitive category matching
        const allRows = db.select().from(sqlite.creators).all();
        const lowerCat = category.toLowerCase();
        rows = allRows.filter((row) => row.category.toLowerCase() === lowerCat);
      } else {
        rows = db.select().from(sqlite.creators).all();
      }
      return rows.map(rowToCreator);
    },
    async upsert(creator: Creator): Promise<Creator> {
      const platform = creator.platform || "instagram";
      const aliasesJson = JSON.stringify(creator.aliases || []);
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.creators).values({
          id: creator.id || randomUUID(),
          platform,
          username: creator.username,
          category: creator.category || "uncategorized",
          profilePicUrl: creator.profilePicUrl || "",
          followers: creator.followers || 0,
          reelsCount30d: creator.reelsCount30d || 0,
          avgViews30d: creator.avgViews30d || 0,
          lastScrapedAt: creator.lastScrapedAt || "",
          aliases: aliasesJson,
        }).onConflictDoUpdate({
          target: [pg.creators.platform, pg.creators.username],
          set: {
            category: creator.category || "uncategorized",
            profilePicUrl: creator.profilePicUrl || "",
            followers: creator.followers || 0,
            reelsCount30d: creator.reelsCount30d || 0,
            avgViews30d: creator.avgViews30d || 0,
            lastScrapedAt: creator.lastScrapedAt || "",
            aliases: aliasesJson,
            updatedAt: new Date().toISOString(),
          },
        });
        return { ...creator, platform };
      }
      const db = ensureSqlite();
      db.insert(sqlite.creators).values({
        id: creator.id || randomUUID(),
        platform,
        username: creator.username,
        category: creator.category || "uncategorized",
        profilePicUrl: creator.profilePicUrl || "",
        followers: creator.followers || 0,
        reelsCount30d: creator.reelsCount30d || 0,
        avgViews30d: creator.avgViews30d || 0,
        lastScrapedAt: creator.lastScrapedAt || "",
        aliases: aliasesJson,
      }).onConflictDoUpdate({
        target: [sqlite.creators.platform, sqlite.creators.username],
        set: {
          category: creator.category || "uncategorized",
          profilePicUrl: creator.profilePicUrl || "",
          followers: creator.followers || 0,
          reelsCount30d: creator.reelsCount30d || 0,
          avgViews30d: creator.avgViews30d || 0,
          lastScrapedAt: creator.lastScrapedAt || "",
          aliases: aliasesJson,
          updatedAt: new Date().toISOString(),
        },
      }).run();
      return { ...creator, platform };
    },
    async update(id: string, updates: Partial<Creator>): Promise<Creator | undefined> {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (updates.platform !== undefined) patch.platform = updates.platform;
      if (updates.username !== undefined) patch.username = updates.username;
      if (updates.category !== undefined) patch.category = updates.category;
      if (updates.profilePicUrl !== undefined) patch.profilePicUrl = updates.profilePicUrl;
      if (updates.followers !== undefined) patch.followers = updates.followers;
      if (updates.reelsCount30d !== undefined) patch.reelsCount30d = updates.reelsCount30d;
      if (updates.avgViews30d !== undefined) patch.avgViews30d = updates.avgViews30d;
      if (updates.lastScrapedAt !== undefined) patch.lastScrapedAt = updates.lastScrapedAt;
      if (updates.aliases !== undefined) patch.aliases = JSON.stringify(updates.aliases);
      if (updates.groupId !== undefined) patch.groupId = updates.groupId;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.creators).set(patch as Record<string, never>).where(eq(pg.creators.id, id));
        return (await this.list()).find((c) => c.id === id);
      }
      const db = ensureSqlite();
      db.update(sqlite.creators).set(patch as Record<string, never>).where(eq(sqlite.creators.id, id)).run();
      return (await this.list()).find((c) => c.id === id);
    },
    async delete(id: string): Promise<void> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.delete(pg.creators).where(eq(pg.creators.id, id));
        return;
      }
      ensureSqlite().delete(sqlite.creators).where(eq(sqlite.creators.id, id)).run();
    },
  },
  configs: {
    async list(): Promise<Config[]> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.configs);
        return rows.map(rowToConfig);
      }
      return ensureSqlite().select().from(sqlite.configs).all().map(rowToConfig);
    },
    async upsert(config: Config): Promise<void> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.configs).values({
          id: config.id || randomUUID(),
          configName: config.configName,
          creatorsCategory: config.creatorsCategory,
          analysisInstruction: config.analysisInstruction || "",
          newConceptsInstruction: config.newConceptsInstruction || "",
        }).onConflictDoUpdate({
          target: pg.configs.configName,
          set: {
            creatorsCategory: config.creatorsCategory,
            analysisInstruction: config.analysisInstruction || "",
            newConceptsInstruction: config.newConceptsInstruction || "",
            updatedAt: new Date().toISOString(),
          },
        });
        return;
      }
      ensureSqlite().insert(sqlite.configs).values({
        id: config.id || randomUUID(),
        configName: config.configName,
        creatorsCategory: config.creatorsCategory,
        analysisInstruction: config.analysisInstruction || "",
        newConceptsInstruction: config.newConceptsInstruction || "",
      }).onConflictDoUpdate({
        target: sqlite.configs.configName,
        set: {
          creatorsCategory: config.creatorsCategory,
          analysisInstruction: config.analysisInstruction || "",
          newConceptsInstruction: config.newConceptsInstruction || "",
          updatedAt: new Date().toISOString(),
        },
      }).run();
    },
  },
  videos: {
    async list(filters?: { configName?: string; creator?: string }): Promise<Video[]> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        let rows = await db.select().from(pg.videos);
        if (filters?.configName) rows = rows.filter((row) => row.configName === filters.configName);
        if (filters?.creator) rows = rows.filter((row) => row.creator === filters.creator);
        return rows.map(rowToVideo).sort((a, b) => {
          const dateDiff = (b.dateAdded || "").localeCompare(a.dateAdded || "");
          return dateDiff !== 0 ? dateDiff : b.views - a.views;
        });
      }
      let rows = ensureSqlite().select().from(sqlite.videos).all();
      if (filters?.configName) rows = rows.filter((row) => row.configName === filters.configName);
      if (filters?.creator) rows = rows.filter((row) => row.creator === filters.creator);
      return rows.map(rowToVideo).sort((a, b) => {
        const dateDiff = (b.dateAdded || "").localeCompare(a.dateAdded || "");
        return dateDiff !== 0 ? dateDiff : b.views - a.views;
      });
    },
    async find(id: string): Promise<Video | undefined> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.videos).where(eq(pg.videos.id, id)).limit(1);
        return rows[0] ? rowToVideo(rows[0]) : undefined;
      }
      const row = ensureSqlite().select().from(sqlite.videos).where(eq(sqlite.videos.id, id)).get();
      return row ? rowToVideo(row) : undefined;
    },
    async upsertScraped(reel: ScrapedReel, options: {
      id?: string;
      configName?: string;
      scrapeRunId?: string;
      provider: string;
      selectedForAnalysis?: boolean;
      viralityScore?: number;
      rankingReason?: string;
      scoreBreakdown?: Record<string, unknown>;
    }): Promise<Video | undefined> {
      // Guard: skip videos with no URL (can happen with flat-playlist entries missing IDs)
      if (!reel.sourcePostUrl || !reel.sourcePostUrl.startsWith("http")) {
        console.warn(`[upsertScraped] Skipping video with invalid sourcePostUrl: "${reel.sourcePostUrl}" (creator: ${reel.creatorUsername})`);
        return undefined;
      }
      const id = options.id || randomUUID();
      const now = new Date().toISOString();
      const cachedThumbnail = await cacheThumbnail(reel.thumbnailUrl, id);
      const values = {
        id,
        platform: reel.platform,
        sourcePostUrl: reel.sourcePostUrl,
        shortcode: reel.shortcode || "",
        thumbnail: cachedThumbnail,
        creator: reel.creatorUsername,
        caption: typeof reel.caption === "string" ? reel.caption : "",
        views: typeof reel.views === "number" ? reel.views : 0,
        likes: typeof reel.likes === "number" ? reel.likes : 0,
        comments: typeof reel.comments === "number" ? reel.comments : 0,
        datePosted: reel.postedAt ? reel.postedAt.slice(0, 10) : "",
        dateAdded: today(),
        configName: options.configName || "",
        scrapeRunId: options.scrapeRunId ?? null,
        provider: options.provider,
        selectedForAnalysis: options.selectedForAnalysis ?? false,
        duration: typeof reel.durationSeconds === "number" ? reel.durationSeconds : null,
        videoFileUrl: typeof reel.videoFileUrl === "string" ? reel.videoFileUrl : null,
        viralityScore: typeof options.viralityScore === "number" ? options.viralityScore : 0,
        rankingReason: typeof options.rankingReason === "string" ? options.rankingReason : "",
        scoreBreakdownJson: stringifyJson(options.scoreBreakdown ?? {}),
        rawProviderPayloadJson: stringifyJson(redactSensitive(reel.rawProviderPayload ?? {})),
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.videos).values(values).onConflictDoUpdate({
          target: [pg.videos.platform, pg.videos.sourcePostUrl],
          set: {
            thumbnail: cachedThumbnail,
            creator: reel.creatorUsername,
            caption: reel.caption,
            views: reel.views,
            likes: reel.likes,
            comments: reel.comments,
            videoFileUrl: reel.videoFileUrl,
            viralityScore: options.viralityScore ?? 0,
            rankingReason: options.rankingReason ?? "",
            scoreBreakdownJson: stringifyJson(options.scoreBreakdown ?? {}),
            rawProviderPayloadJson: stringifyJson(redactSensitive(reel.rawProviderPayload ?? {})),
            updatedAt: now,
          },
        });
        const rows = await db.select().from(pg.videos).where(eq(pg.videos.sourcePostUrl, reel.sourcePostUrl)).limit(1);
        return rows[0] ? rowToVideo(rows[0]) : this.find(id);
      }
      const db = ensureSqlite();
      db.insert(sqlite.videos).values(values).onConflictDoUpdate({
        target: [sqlite.videos.platform, sqlite.videos.sourcePostUrl],
        set: {
          thumbnail: cachedThumbnail,
          creator: reel.creatorUsername,
          caption: reel.caption,
          views: reel.views,
          likes: reel.likes,
          comments: reel.comments,
          videoFileUrl: reel.videoFileUrl,
          viralityScore: options.viralityScore ?? 0,
          rankingReason: options.rankingReason ?? "",
          scoreBreakdownJson: stringifyJson(options.scoreBreakdown ?? {}),
          rawProviderPayloadJson: stringifyJson(redactSensitive(reel.rawProviderPayload ?? {})),
          updatedAt: now,
        },
      }).run();
      const row = db.select().from(sqlite.videos).where(eq(sqlite.videos.sourcePostUrl, reel.sourcePostUrl)).get();
      return row ? rowToVideo(row) : this.find(id);
    },
    async update(id: string, updates: Partial<Video>): Promise<Video | undefined> {
      const patch: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (updates.thumbnail !== undefined) patch.thumbnail = updates.thumbnail;
      if (updates.views !== undefined) patch.views = updates.views;
      if (updates.likes !== undefined) patch.likes = updates.likes;
      if (updates.comments !== undefined) patch.comments = updates.comments;
      if (updates.analysis !== undefined) patch.analysis = updates.analysis;
      if (updates.analysisJson !== undefined) patch.analysisJson = stringifyJson(updates.analysisJson);
      if (updates.newConcepts !== undefined) patch.newConcepts = updates.newConcepts;
      if (updates.starred !== undefined) patch.starred = updates.starred;
      if (updates.transcript !== undefined) patch.transcript = updates.transcript;
      if (updates.videoFileUrl !== undefined) patch.videoFileUrl = updates.videoFileUrl;
      if (updates.viralityScore !== undefined) patch.viralityScore = updates.viralityScore;
      if (updates.rankingReason !== undefined) patch.rankingReason = updates.rankingReason;
      if (updates.scoreBreakdown !== undefined) patch.scoreBreakdownJson = stringifyJson(updates.scoreBreakdown);
      if (updates.analysisStatus !== undefined) patch.analysisStatus = updates.analysisStatus;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.videos).set(patch as Record<string, never>).where(eq(pg.videos.id, id));
        return this.find(id);
      }
      ensureSqlite().update(sqlite.videos).set(patch as Record<string, never>).where(eq(sqlite.videos.id, id)).run();
      return this.find(id);
    },
    async delete(id: string): Promise<void> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.delete(pg.videos).where(eq(pg.videos.id, id));
        return;
      }
      ensureSqlite().delete(sqlite.videos).where(eq(sqlite.videos.id, id)).run();
    },
  },
  scripts: {
    async list(): Promise<Script[]> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.scripts);
        return rows.map(rowToScript);
      }
      return ensureSqlite().select().from(sqlite.scripts).all().map(rowToScript);
    },
    async upsert(script: Script): Promise<Script> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.scripts).values({
          id: script.id || randomUUID(),
          videoId: script.videoId || "",
          generationRunId: script.generationRunId || "legacy",
          scriptVariant: script.scriptVariant || "safe",
          videoCreator: script.videoCreator || "",
          videoViews: script.videoViews || 0,
          videoLink: script.videoLink || "",
          title: script.title || "",
          hook: script.hook || "",
          script: script.script || "",
          spokenScript: script.spokenScript || "",
          cta: script.cta || "",
          sourceInspiration: script.sourceInspiration || "",
          similarityScore: script.similarityScore || 0,
          qualityScore: script.qualityScore || 0,
          platform: script.platform || "instagram",
          estimatedDuration: script.estimatedDuration || "",
          estimatedDurationSeconds: script.estimatedDurationSeconds || 0,
          contentType: script.contentType || "",
          dateGenerated: script.dateGenerated || today(),
          starred: script.starred || false,
          videoJobId: script.videoJobId ?? null,
          videoStatus: script.videoStatus ?? null,
          videoUrl: script.videoUrl ?? null,
          geminiCheck: script.geminiCheck ?? null,
          claudeCheck: script.claudeCheck ?? null,
          imagePrompt: script.imagePrompt ?? null,
          videoPrompt: script.videoPrompt ?? null,
          avatarId: script.avatarId ?? null,
          generatedImageUrl: script.generatedImageUrl ?? null,
          videoMode: script.videoMode ?? null,
          videoProvider: script.videoProvider ?? null,
          sourceVideoUrl: script.sourceVideoUrl ?? null,
          parentScriptId: script.parentScriptId ?? null,
          version: script.version ?? 1,
          abGroup: script.abGroup ?? null,
          performanceViews: script.performanceViews ?? 0,
          performanceTrackedAt: script.performanceTrackedAt ?? null,
        }).onConflictDoUpdate({
          target: [pg.scripts.videoId, pg.scripts.scriptVariant, pg.scripts.generationRunId],
          set: {
            title: script.title,
            hook: script.hook,
            script: script.script,
            spokenScript: script.spokenScript || "",
            qualityScore: script.qualityScore || 0,
            updatedAt: new Date().toISOString(),
          },
        });
        return script;
      }
      ensureSqlite().insert(sqlite.scripts).values({
        id: script.id || randomUUID(),
        videoId: script.videoId || "",
        generationRunId: script.generationRunId || "legacy",
        scriptVariant: script.scriptVariant || "safe",
        videoCreator: script.videoCreator || "",
        videoViews: script.videoViews || 0,
        videoLink: script.videoLink || "",
        title: script.title || "",
        hook: script.hook || "",
        script: script.script || "",
        spokenScript: script.spokenScript || "",
        cta: script.cta || "",
        sourceInspiration: script.sourceInspiration || "",
        similarityScore: script.similarityScore || 0,
        qualityScore: script.qualityScore || 0,
        platform: script.platform || "instagram",
        estimatedDuration: script.estimatedDuration || "",
        estimatedDurationSeconds: script.estimatedDurationSeconds || 0,
        contentType: script.contentType || "",
        dateGenerated: script.dateGenerated || today(),
        starred: script.starred || false,
        videoJobId: script.videoJobId ?? null,
        videoStatus: script.videoStatus ?? null,
        videoUrl: script.videoUrl ?? null,
        geminiCheck: script.geminiCheck ?? null,
        claudeCheck: script.claudeCheck ?? null,
        imagePrompt: script.imagePrompt ?? null,
        videoPrompt: script.videoPrompt ?? null,
        avatarId: script.avatarId ?? null,
        generatedImageUrl: script.generatedImageUrl ?? null,
        videoMode: script.videoMode ?? null,
        videoProvider: script.videoProvider ?? null,
        sourceVideoUrl: script.sourceVideoUrl ?? null,
        parentScriptId: script.parentScriptId ?? null,
        version: script.version ?? 1,
        abGroup: script.abGroup ?? null,
        performanceViews: script.performanceViews ?? 0,
        performanceTrackedAt: script.performanceTrackedAt ?? null,
      }).onConflictDoUpdate({
        target: [sqlite.scripts.videoId, sqlite.scripts.scriptVariant, sqlite.scripts.generationRunId],
        set: {
          title: script.title,
          hook: script.hook,
          script: script.script,
          spokenScript: script.spokenScript || "",
          qualityScore: script.qualityScore || 0,
          updatedAt: new Date().toISOString(),
        },
      }).run();
      return script;
    },
    async update(id: string, updates: Partial<Script>): Promise<Script | undefined> {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if ("starred" in updates) patch.starred = updates.starred;
      if ("videoJobId" in updates) patch.videoJobId = updates.videoJobId ?? null;
      if ("videoStatus" in updates) patch.videoStatus = updates.videoStatus ?? null;
      if ("videoUrl" in updates) patch.videoUrl = updates.videoUrl ?? null;
      if ("geminiCheck" in updates) patch.geminiCheck = updates.geminiCheck ?? null;
      if ("claudeCheck" in updates) patch.claudeCheck = updates.claudeCheck ?? null;
      if ("imagePrompt" in updates) patch.imagePrompt = updates.imagePrompt ?? null;
      if ("videoPrompt" in updates) patch.videoPrompt = updates.videoPrompt ?? null;
      if ("avatarId" in updates) patch.avatarId = updates.avatarId ?? null;
      if ("generatedImageUrl" in updates) patch.generatedImageUrl = updates.generatedImageUrl ?? null;
      if ("videoMode" in updates) patch.videoMode = updates.videoMode ?? null;
      if ("videoProvider" in updates) patch.videoProvider = updates.videoProvider ?? null;
      if ("sourceVideoUrl" in updates) patch.sourceVideoUrl = updates.sourceVideoUrl ?? null;
      if ("abGroup" in updates) patch.abGroup = updates.abGroup ?? null;
      if ("performanceViews" in updates) patch.performanceViews = updates.performanceViews ?? 0;
      if ("performanceTrackedAt" in updates) patch.performanceTrackedAt = updates.performanceTrackedAt ?? null;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.scripts).set(patch as Record<string, never>).where(eq(pg.scripts.id, id));
        return (await this.list()).find((s) => s.id === id);
      }
      ensureSqlite().update(sqlite.scripts).set(patch as Record<string, never>).where(eq(sqlite.scripts.id, id)).run();
      return (await this.list()).find((s) => s.id === id);
    },
    async delete(id: string): Promise<void> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.delete(pg.scripts).where(eq(pg.scripts.id, id));
        return;
      }
      ensureSqlite().delete(sqlite.scripts).where(eq(sqlite.scripts.id, id)).run();
    },
  },
  runs: {
    async create(params: PipelineParams): Promise<PipelineRun> {
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = {
        id,
        configName: params.configName,
        provider: params.scraperProvider || "local",
        status: "queued",
        freeMode: params.freeMode ?? true,
        cancelRequested: false,
        paramsJson: stringifyJson(params),
        progressJson: stringifyJson({ phase: "queued", completed: 0, total: 0 }),
        errorJson: "[]",
        createdAt: now,
        updatedAt: now,
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.scrapeRuns).values(row);
      } else {
        ensureSqlite().insert(sqlite.scrapeRuns).values(row).run();
      }
      return (await this.get(id))!;
    },
    async list(): Promise<PipelineRun[]> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.scrapeRuns);
        return rows.map(rowToRun).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      return ensureSqlite().select().from(sqlite.scrapeRuns).all().map(rowToRun).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async get(id: string): Promise<PipelineRun | undefined> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.scrapeRuns).where(eq(pg.scrapeRuns.id, id)).limit(1);
        return rows[0] ? rowToRun(rows[0]) : undefined;
      }
      const row = ensureSqlite().select().from(sqlite.scrapeRuns).where(eq(sqlite.scrapeRuns.id, id)).get();
      return row ? rowToRun(row) : undefined;
    },
    async update(id: string, updates: Partial<PipelineRun> & { cancelRequested?: boolean }): Promise<PipelineRun | undefined> {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.progress !== undefined) patch.progressJson = stringifyJson(updates.progress);
      if (updates.errors !== undefined) patch.errorJson = stringifyJson(updates.errors);
      if (updates.startedAt !== undefined) patch.startedAt = updates.startedAt;
      if (updates.completedAt !== undefined) patch.completedAt = updates.completedAt;
      if (updates.cancelRequested !== undefined) patch.cancelRequested = updates.cancelRequested;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.scrapeRuns).set(patch as Record<string, never>).where(eq(pg.scrapeRuns.id, id));
      } else {
        ensureSqlite().update(sqlite.scrapeRuns).set(patch as Record<string, never>).where(eq(sqlite.scrapeRuns.id, id)).run();
      }
      return this.get(id);
    },
    async addError(id: string, error: { code: ProviderErrorCode; message: string; target?: string }): Promise<void> {
      const run = await this.get(id);
      if (!run) return;
      await this.update(id, { errors: [...run.errors, error] });
    },
  },
  providerLogs: {
    async add(input: Omit<ProviderLog, "id" | "createdAt">): Promise<void> {
      const id = randomUUID();
      const row = {
        id,
        provider: input.provider,
        operation: input.operation,
        status: input.status,
        requestJson: stringifyJson(redactSensitive(input.request)),
        responseJson: stringifyJson(redactSensitive(input.response)),
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        durationMs: input.durationMs,
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.providerLogs).values(row);
        return;
      }
      ensureSqlite().insert(sqlite.providerLogs).values(row).run();
    },
  },
  scrapeRunItems: {
    async insert(input: {
      id: string;
      scrapeRunId: string;
      creatorUsername: string;
      videoId?: string | null;
      status: string;
      step: string;
    }): Promise<void> {
      const now = new Date().toISOString();
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.scrapeRunItems).values({
          id: input.id,
          scrapeRunId: input.scrapeRunId,
          creatorUsername: input.creatorUsername,
          videoId: input.videoId ?? null,
          status: input.status,
          step: input.step,
          createdAt: now,
          updatedAt: now,
        });
        return;
      }
      ensureSqlite().insert(sqlite.scrapeRunItems).values({
        id: input.id,
        scrapeRunId: input.scrapeRunId,
        creatorUsername: input.creatorUsername,
        videoId: input.videoId ?? null,
        status: input.status,
        step: input.step,
        createdAt: now,
        updatedAt: now,
      }).run();
    },
    async update(
      id: string,
      updates: Partial<{ status: string; step: string; videoId: string | null; errorCode: string | null; errorMessage: string | null }>
    ): Promise<void> {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.step !== undefined) patch.step = updates.step;
      if (updates.videoId !== undefined) patch.videoId = updates.videoId;
      if (updates.errorCode !== undefined) patch.errorCode = updates.errorCode;
      if (updates.errorMessage !== undefined) patch.errorMessage = updates.errorMessage;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.scrapeRunItems).set(patch as Record<string, never>).where(eq(pg.scrapeRunItems.id, id));
        return;
      }
      ensureSqlite().update(sqlite.scrapeRunItems).set(patch as Record<string, never>).where(eq(sqlite.scrapeRunItems.id, id)).run();
    },
    async listByRun(scrapeRunId: string) {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        return await db.select().from(pg.scrapeRunItems).where(eq(pg.scrapeRunItems.scrapeRunId, scrapeRunId));
      }
      return ensureSqlite().select().from(sqlite.scrapeRunItems).where(eq(sqlite.scrapeRunItems.scrapeRunId, scrapeRunId)).all();
    },
  },
  analysisRuns: {
    async insert(input: {
      id: string;
      videoId: string;
      provider: string;
      status: string;
      analysisJson?: string;
    }): Promise<void> {
      const now = new Date().toISOString();
      const base = {
        id: input.id,
        videoId: input.videoId,
        provider: input.provider,
        status: input.status,
        analysisJson: input.analysisJson ?? "{}",
        createdAt: now,
        updatedAt: now,
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.analysisRuns).values(base);
        return;
      }
      ensureSqlite().insert(sqlite.analysisRuns).values(base).run();
    },
    async update(
      id: string,
      updates: Partial<{ status: string; analysisJson: string; errorCode: string | null; errorMessage: string | null }>
    ): Promise<void> {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.analysisJson !== undefined) patch.analysisJson = updates.analysisJson;
      if (updates.errorCode !== undefined) patch.errorCode = updates.errorCode;
      if (updates.errorMessage !== undefined) patch.errorMessage = updates.errorMessage;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.analysisRuns).set(patch as Record<string, never>).where(eq(pg.analysisRuns.id, id));
        return;
      }
      ensureSqlite().update(sqlite.analysisRuns).set(patch as Record<string, never>).where(eq(sqlite.analysisRuns.id, id)).run();
    },
    async listByRunId(scrapeRunId: string) {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const items = await db.select().from(pg.scrapeRunItems).where(eq(pg.scrapeRunItems.scrapeRunId, scrapeRunId));
        const videoIds = [...new Set(items.map((i) => i.videoId).filter(Boolean))] as string[];
        if (videoIds.length === 0) return [];
        const out: (typeof pg.analysisRuns.$inferSelect)[] = [];
        for (const vid of videoIds) {
          const rows = await db.select().from(pg.analysisRuns).where(eq(pg.analysisRuns.videoId, vid));
          out.push(...rows);
        }
        return out;
      }
      const items = ensureSqlite().select().from(sqlite.scrapeRunItems).where(eq(sqlite.scrapeRunItems.scrapeRunId, scrapeRunId)).all();
      const videoIds = [...new Set(items.map((i) => i.videoId).filter(Boolean))] as string[];
      const out: (typeof sqlite.analysisRuns.$inferSelect)[] = [];
      for (const vid of videoIds) {
        out.push(...ensureSqlite().select().from(sqlite.analysisRuns).where(eq(sqlite.analysisRuns.videoId, vid)).all());
      }
      return out;
    },
  },
  creatorGroups: {
    async list(): Promise<CreatorGroup[]> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.creatorGroups);
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          canonicalUsername: r.canonicalUsername,
          avatarUrl: r.avatarUrl,
          notes: r.notes,
        }));
      }
      const rows = ensureSqlite().select().from(sqlite.creatorGroups).all();
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        canonicalUsername: r.canonicalUsername,
        avatarUrl: r.avatarUrl,
        notes: r.notes,
      }));
    },
    async get(id: string): Promise<CreatorGroup | undefined> {
      const all = await this.list();
      return all.find((g) => g.id === id);
    },
    async create(input: Omit<CreatorGroup, "id">): Promise<CreatorGroup> {
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = {
        id,
        name: input.name,
        canonicalUsername: input.canonicalUsername,
        avatarUrl: input.avatarUrl || "",
        notes: input.notes || "",
        createdAt: now,
        updatedAt: now,
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.creatorGroups).values(row);
      } else {
        ensureSqlite().insert(sqlite.creatorGroups).values(row).run();
      }
      return { id, ...input };
    },
    async update(id: string, updates: Partial<CreatorGroup>): Promise<void> {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.canonicalUsername !== undefined) patch.canonicalUsername = updates.canonicalUsername;
      if (updates.avatarUrl !== undefined) patch.avatarUrl = updates.avatarUrl;
      if (updates.notes !== undefined) patch.notes = updates.notes;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.creatorGroups).set(patch as Record<string, never>).where(eq(pg.creatorGroups.id, id));
        return;
      }
      ensureSqlite().update(sqlite.creatorGroups).set(patch as Record<string, never>).where(eq(sqlite.creatorGroups.id, id)).run();
    },
    async delete(id: string): Promise<void> {
      // Unlink all creators in this group first
      const allCreators = await repo.creators.list();
      for (const creator of allCreators.filter((c) => c.groupId === id)) {
        await repo.creators.update(creator.id, { groupId: null });
      }
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.delete(pg.creatorGroups).where(eq(pg.creatorGroups.id, id));
        return;
      }
      ensureSqlite().delete(sqlite.creatorGroups).where(eq(sqlite.creatorGroups.id, id)).run();
    },
  },
  schedulerJobs: {
    async list(): Promise<SchedulerJob[]> {
      const rows = isPostgresMode()
        ? await (await getPgDrizzle()).select().from(pg.schedulerJobs)
        : ensureSqlite().select().from(sqlite.schedulerJobs).all();
      return rows.map((r) => ({
        id: r.id,
        creatorId: r.creatorId,
        platform: r.platform as SchedulerJob["platform"],
        intervalMinutes: r.intervalMinutes,
        lastRunAt: r.lastRunAt,
        nextRunAt: r.nextRunAt,
        status: r.status as SchedulerJob["status"],
        lastError: r.lastError,
        consecutiveErrors: r.consecutiveErrors,
        enabled: r.enabled,
      }));
    },
    async listDue(): Promise<SchedulerJob[]> {
      const all = await this.list();
      const now = new Date().toISOString();
      return all.filter((j) => j.enabled && j.status !== "running" && j.nextRunAt <= now);
    },
    async upsert(job: Omit<SchedulerJob, "id">, existingId?: string): Promise<SchedulerJob> {
      const id = existingId || randomUUID();
      const now = new Date().toISOString();
      const row = {
        id,
        creatorId: job.creatorId,
        platform: job.platform,
        intervalMinutes: job.intervalMinutes,
        lastRunAt: job.lastRunAt ?? null,
        nextRunAt: job.nextRunAt,
        status: job.status,
        lastError: job.lastError ?? null,
        consecutiveErrors: job.consecutiveErrors,
        enabled: job.enabled,
        createdAt: now,
        updatedAt: now,
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.schedulerJobs).values(row).onConflictDoUpdate({
          target: [pg.schedulerJobs.creatorId, pg.schedulerJobs.platform],
          set: {
            intervalMinutes: job.intervalMinutes,
            nextRunAt: job.nextRunAt,
            status: job.status,
            enabled: job.enabled,
            updatedAt: now,
          },
        });
      } else {
        ensureSqlite().insert(sqlite.schedulerJobs).values(row).onConflictDoUpdate({
          target: [sqlite.schedulerJobs.creatorId, sqlite.schedulerJobs.platform],
          set: {
            intervalMinutes: job.intervalMinutes,
            nextRunAt: job.nextRunAt,
            status: job.status,
            enabled: job.enabled,
            updatedAt: now,
          },
        }).run();
      }
      return { id, ...job };
    },
    async update(id: string, updates: Partial<SchedulerJob>): Promise<void> {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (updates.intervalMinutes !== undefined) patch.intervalMinutes = updates.intervalMinutes;
      if (updates.lastRunAt !== undefined) patch.lastRunAt = updates.lastRunAt;
      if (updates.nextRunAt !== undefined) patch.nextRunAt = updates.nextRunAt;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.lastError !== undefined) patch.lastError = updates.lastError;
      if (updates.consecutiveErrors !== undefined) patch.consecutiveErrors = updates.consecutiveErrors;
      if (updates.enabled !== undefined) patch.enabled = updates.enabled;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.schedulerJobs).set(patch as Record<string, never>).where(eq(pg.schedulerJobs.id, id));
        return;
      }
      ensureSqlite().update(sqlite.schedulerJobs).set(patch as Record<string, never>).where(eq(sqlite.schedulerJobs.id, id)).run();
    },
    async delete(id: string): Promise<void> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.delete(pg.schedulerJobs).where(eq(pg.schedulerJobs.id, id));
        return;
      }
      ensureSqlite().delete(sqlite.schedulerJobs).where(eq(sqlite.schedulerJobs.id, id)).run();
    },
  },
  viralAlerts: {
    async list(filters?: { unseen?: boolean; dismissed?: boolean }): Promise<ViralAlert[]> {
      const rows = isPostgresMode()
        ? await (await getPgDrizzle()).select().from(pg.viralAlerts)
        : ensureSqlite().select().from(sqlite.viralAlerts).all();
      const mapped = rows.map((r) => ({
        id: r.id,
        videoId: r.videoId,
        creatorId: r.creatorId,
        creatorUsername: r.creatorUsername,
        platform: r.platform as ViralAlert["platform"],
        viralityScore: r.viralityScore,
        thresholdUsed: r.thresholdUsed,
        scoreBreakdown: parseJson(r.scoreBreakdownJson, {}),
        seen: r.seen,
        notified: r.notified,
        dismissed: r.dismissed,
        createdAt: r.createdAt,
      })) as ViralAlert[];
      let filtered = mapped;
      if (filters?.unseen) filtered = filtered.filter((a) => !a.seen);
      if (filters?.dismissed === false) filtered = filtered.filter((a) => !a.dismissed);
      return filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    },
    async create(alert: Omit<ViralAlert, "id" | "createdAt" | "seen" | "notified" | "dismissed">): Promise<ViralAlert> {
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = {
        id,
        videoId: alert.videoId,
        creatorId: alert.creatorId ?? null,
        creatorUsername: alert.creatorUsername,
        platform: alert.platform,
        viralityScore: alert.viralityScore,
        thresholdUsed: alert.thresholdUsed,
        scoreBreakdownJson: stringifyJson(alert.scoreBreakdown ?? {}),
        seen: false,
        notified: false,
        dismissed: false,
        createdAt: now,
        updatedAt: now,
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.viralAlerts).values(row);
      } else {
        ensureSqlite().insert(sqlite.viralAlerts).values(row).run();
      }
      return { ...alert, id, seen: false, notified: false, dismissed: false, createdAt: now };
    },
    async update(id: string, updates: Partial<ViralAlert>): Promise<void> {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (updates.seen !== undefined) patch.seen = updates.seen;
      if (updates.notified !== undefined) patch.notified = updates.notified;
      if (updates.dismissed !== undefined) patch.dismissed = updates.dismissed;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.viralAlerts).set(patch as Record<string, never>).where(eq(pg.viralAlerts.id, id));
        return;
      }
      ensureSqlite().update(sqlite.viralAlerts).set(patch as Record<string, never>).where(eq(sqlite.viralAlerts.id, id)).run();
    },
    async existsForVideo(videoId: string): Promise<boolean> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.viralAlerts).where(eq(pg.viralAlerts.videoId, videoId)).limit(1);
        return rows.length > 0;
      }
      const row = ensureSqlite().select().from(sqlite.viralAlerts).where(eq(sqlite.viralAlerts.videoId, videoId)).get();
      return Boolean(row);
    },
    async countUnseen(): Promise<number> {
      const all = await this.list({ unseen: true, dismissed: false });
      return all.length;
    },
  },
  contentCalendar: {
    async list(): Promise<ContentCalendarEntry[]> {
      const rows = isPostgresMode()
        ? await (await getPgDrizzle()).select().from(pg.contentCalendar)
        : ensureSqlite().select().from(sqlite.contentCalendar).all();
      return rows.map((r) => ({
        id: r.id,
        scriptId: r.scriptId ?? null,
        scheduledDate: r.scheduledDate,
        platform: (r.platform || "instagram") as ContentCalendarEntry["platform"],
        status: (r.status as ContentCalendarEntry["status"]) || "draft",
        postedUrl: r.postedUrl ?? null,
        notes: r.notes ?? null,
        title: r.title || "",
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    },
    async create(entry: Omit<ContentCalendarEntry, "id" | "createdAt" | "updatedAt">): Promise<ContentCalendarEntry> {
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = {
        id,
        scriptId: entry.scriptId ?? null,
        scheduledDate: entry.scheduledDate,
        platform: entry.platform,
        status: entry.status || "draft",
        postedUrl: entry.postedUrl ?? null,
        notes: entry.notes ?? null,
        title: entry.title || "",
        createdAt: now,
        updatedAt: now,
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.contentCalendar).values(row);
      } else {
        ensureSqlite().insert(sqlite.contentCalendar).values(row).run();
      }
      return { ...entry, id, createdAt: now, updatedAt: now };
    },
    async update(id: string, updates: Partial<ContentCalendarEntry>): Promise<void> {
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (updates.scriptId !== undefined) patch.scriptId = updates.scriptId ?? null;
      if (updates.scheduledDate !== undefined) patch.scheduledDate = updates.scheduledDate;
      if (updates.platform !== undefined) patch.platform = updates.platform;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.postedUrl !== undefined) patch.postedUrl = updates.postedUrl ?? null;
      if (updates.notes !== undefined) patch.notes = updates.notes ?? null;
      if (updates.title !== undefined) patch.title = updates.title;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.contentCalendar).set(patch as Record<string, never>).where(eq(pg.contentCalendar.id, id));
        return;
      }
      ensureSqlite().update(sqlite.contentCalendar).set(patch as Record<string, never>).where(eq(sqlite.contentCalendar.id, id)).run();
    },
    async delete(id: string): Promise<void> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.delete(pg.contentCalendar).where(eq(pg.contentCalendar.id, id));
        return;
      }
      ensureSqlite().delete(sqlite.contentCalendar).where(eq(sqlite.contentCalendar.id, id)).run();
    },
  },
  postedContent: {
    async list(): Promise<PostedContent[]> {
      const rows = isPostgresMode()
        ? await (await getPgDrizzle()).select().from(pg.postedContent)
        : ensureSqlite().select().from(sqlite.postedContent).all();
      return rows.map((r) => ({
        id: r.id,
        scriptId: r.scriptId ?? null,
        postedUrl: r.postedUrl,
        platform: (r.platform || "instagram") as PostedContent["platform"],
        postedAt: r.postedAt,
        views24h: r.views24h || 0,
        views48h: r.views48h || 0,
        views7d: r.views7d || 0,
        likes7d: r.likes7d || 0,
        comments7d: r.comments7d || 0,
        lastCheckedAt: r.lastCheckedAt ?? null,
        createdAt: r.createdAt,
      }));
    },
    async create(entry: Omit<PostedContent, "id" | "createdAt">): Promise<PostedContent> {
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = {
        id,
        scriptId: entry.scriptId ?? null,
        postedUrl: entry.postedUrl,
        platform: entry.platform,
        postedAt: entry.postedAt,
        views24h: entry.views24h || 0,
        views48h: entry.views48h || 0,
        views7d: entry.views7d || 0,
        likes7d: entry.likes7d || 0,
        comments7d: entry.comments7d || 0,
        lastCheckedAt: entry.lastCheckedAt ?? null,
        createdAt: now,
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.postedContent).values(row);
      } else {
        ensureSqlite().insert(sqlite.postedContent).values(row).run();
      }
      return { ...entry, id, createdAt: now };
    },
    async update(id: string, updates: Partial<PostedContent>): Promise<void> {
      const patch: Record<string, unknown> = {};
      if (updates.views24h !== undefined) patch.views24h = updates.views24h;
      if (updates.views48h !== undefined) patch.views48h = updates.views48h;
      if (updates.views7d !== undefined) patch.views7d = updates.views7d;
      if (updates.likes7d !== undefined) patch.likes7d = updates.likes7d;
      if (updates.comments7d !== undefined) patch.comments7d = updates.comments7d;
      if (updates.lastCheckedAt !== undefined) patch.lastCheckedAt = updates.lastCheckedAt ?? null;
      if (Object.keys(patch).length === 0) return;
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.postedContent).set(patch as Record<string, never>).where(eq(pg.postedContent.id, id));
        return;
      }
      ensureSqlite().update(sqlite.postedContent).set(patch as Record<string, never>).where(eq(sqlite.postedContent.id, id)).run();
    },
    async delete(id: string): Promise<void> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.delete(pg.postedContent).where(eq(pg.postedContent.id, id));
        return;
      }
      ensureSqlite().delete(sqlite.postedContent).where(eq(sqlite.postedContent.id, id)).run();
    },
  },
  intelligenceReports: {
    async list(): Promise<IntelligenceReport[]> {
      const rows = isPostgresMode()
        ? await (await getPgDrizzle()).select().from(pg.intelligenceReports)
        : ensureSqlite().select().from(sqlite.intelligenceReports).all();
      return rows
        .map((r) => ({
          id: r.id,
          configName: r.configName || "",
          periodFrom: r.periodFrom,
          periodTo: r.periodTo,
          reportJson: r.reportJson,
          createdAt: r.createdAt,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async get(id: string): Promise<IntelligenceReport | undefined> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.intelligenceReports).where(eq(pg.intelligenceReports.id, id)).limit(1);
        if (!rows[0]) return undefined;
        return {
          id: rows[0].id,
          configName: rows[0].configName || "",
          periodFrom: rows[0].periodFrom,
          periodTo: rows[0].periodTo,
          reportJson: rows[0].reportJson,
          createdAt: rows[0].createdAt,
        };
      }
      const row = ensureSqlite().select().from(sqlite.intelligenceReports).where(eq(sqlite.intelligenceReports.id, id)).get();
      if (!row) return undefined;
      return {
        id: row.id,
        configName: row.configName || "",
        periodFrom: row.periodFrom,
        periodTo: row.periodTo,
        reportJson: row.reportJson,
        createdAt: row.createdAt,
      };
    },
    async create(entry: Omit<IntelligenceReport, "id" | "createdAt">): Promise<IntelligenceReport> {
      const id = randomUUID();
      const now = new Date().toISOString();
      const row = {
        id,
        configName: entry.configName || "",
        periodFrom: entry.periodFrom,
        periodTo: entry.periodTo,
        reportJson: entry.reportJson,
        createdAt: now,
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.intelligenceReports).values(row);
      } else {
        ensureSqlite().insert(sqlite.intelligenceReports).values(row).run();
      }
      return { ...entry, id, createdAt: now };
    },
    async delete(id: string): Promise<void> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.delete(pg.intelligenceReports).where(eq(pg.intelligenceReports.id, id));
        return;
      }
      ensureSqlite().delete(sqlite.intelligenceReports).where(eq(sqlite.intelligenceReports.id, id)).run();
    },
  },
  settings: {
    async get<T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.appSettings).where(eq(pg.appSettings.key, key)).limit(1);
        if (!rows[0]) return defaultValue;
        return parseJson<T>(rows[0].valueJson, defaultValue as T);
      }
      const row = ensureSqlite().select().from(sqlite.appSettings).where(eq(sqlite.appSettings.key, key)).get();
      if (!row) return defaultValue;
      return parseJson<T>(row.valueJson, defaultValue as T);
    },
    async set(key: string, value: unknown): Promise<void> {
      const valueJson = stringifyJson(value);
      const now = new Date().toISOString();
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.appSettings).values({
          key,
          valueJson,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: pg.appSettings.key,
          set: { valueJson, updatedAt: now },
        });
        return;
      }
      ensureSqlite().insert(sqlite.appSettings).values({
        key,
        valueJson,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: sqlite.appSettings.key,
        set: { valueJson, updatedAt: now },
      }).run();
    },
    async delete(key: string): Promise<void> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.delete(pg.appSettings).where(eq(pg.appSettings.key, key));
        return;
      }
      ensureSqlite().delete(sqlite.appSettings).where(eq(sqlite.appSettings.key, key)).run();
    },
    async getAll(): Promise<Record<string, unknown>> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        const rows = await db.select().from(pg.appSettings);
        return rows.reduce<Record<string, unknown>>((acc, row) => {
          acc[row.key] = parseJson(row.valueJson, {});
          return acc;
        }, {});
      }
      const rows = ensureSqlite().select().from(sqlite.appSettings).all();
      return rows.reduce<Record<string, unknown>>((acc, row) => {
        acc[row.key] = parseJson(row.valueJson, {});
        return acc;
      }, {});
    },
  },
};

export async function closeDbForTests() {
  const { closeDbForTests: closeSqlite } = await import("./client");
  closeSqlite();
  const { closePgForTests } = await import("./client-pg");
  await closePgForTests();
}
