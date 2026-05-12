import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { getPgDrizzle } from "./client-pg";
import { migrateDb } from "./migrate";
import * as sqlite from "./schema";
import * as pg from "./schema-pg";
import { parseJson, redactSensitive, stringifyJson } from "@/lib/json";
import { getEnv, isPostgresDatabaseUrl } from "@/lib/env";
import type {
  Config,
  Creator,
  PipelineParams,
  PipelineRun,
  ProviderErrorCode,
  ProviderLog,
  Script,
  ScrapedReel,
  Video,
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
}): Creator {
  const platform = (row.platform === "tiktok" || row.platform === "youtube_shorts"
    ? row.platform
    : "instagram") as Creator["platform"];
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
  };
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
        const rows = category
          ? await db.select().from(pg.creators).where(eq(pg.creators.category, category))
          : await db.select().from(pg.creators);
        return rows.map(rowToCreator);
      }
      const db = ensureSqlite();
      const rows = category
        ? db.select().from(sqlite.creators).where(eq(sqlite.creators.category, category)).all()
        : db.select().from(sqlite.creators).all();
      return rows.map(rowToCreator);
    },
    async upsert(creator: Creator): Promise<Creator> {
      const platform = creator.platform || "instagram";
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
        }).onConflictDoUpdate({
          target: [pg.creators.platform, pg.creators.username],
          set: {
            category: creator.category || "uncategorized",
            profilePicUrl: creator.profilePicUrl || "",
            followers: creator.followers || 0,
            reelsCount30d: creator.reelsCount30d || 0,
            avgViews30d: creator.avgViews30d || 0,
            lastScrapedAt: creator.lastScrapedAt || "",
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
      }).onConflictDoUpdate({
        target: [sqlite.creators.platform, sqlite.creators.username],
        set: {
          category: creator.category || "uncategorized",
          profilePicUrl: creator.profilePicUrl || "",
          followers: creator.followers || 0,
          reelsCount30d: creator.reelsCount30d || 0,
          avgViews30d: creator.avgViews30d || 0,
          lastScrapedAt: creator.lastScrapedAt || "",
          updatedAt: new Date().toISOString(),
        },
      }).run();
      return { ...creator, platform };
    },
    async update(id: string, updates: Partial<Creator>): Promise<Creator | undefined> {
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.creators).set({
          username: updates.username,
          category: updates.category,
          profilePicUrl: updates.profilePicUrl,
          followers: updates.followers,
          reelsCount30d: updates.reelsCount30d,
          avgViews30d: updates.avgViews30d,
          lastScrapedAt: updates.lastScrapedAt,
          updatedAt: new Date().toISOString(),
        }).where(eq(pg.creators.id, id));
        return (await this.list()).find((c) => c.id === id);
      }
      const db = ensureSqlite();
      db.update(sqlite.creators).set({
        username: updates.username,
        category: updates.category,
        profilePicUrl: updates.profilePicUrl,
        followers: updates.followers,
        reelsCount30d: updates.reelsCount30d,
        avgViews30d: updates.avgViews30d,
        lastScrapedAt: updates.lastScrapedAt,
        updatedAt: new Date().toISOString(),
      }).where(eq(sqlite.creators.id, id)).run();
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
      const id = options.id || randomUUID();
      const now = new Date().toISOString();
      const values = {
        id,
        platform: reel.platform,
        sourcePostUrl: reel.sourcePostUrl,
        shortcode: reel.shortcode,
        thumbnail: reel.thumbnailUrl,
        creator: reel.creatorUsername,
        caption: reel.caption,
        views: reel.views,
        likes: reel.likes,
        comments: reel.comments,
        datePosted: reel.postedAt ? reel.postedAt.slice(0, 10) : "",
        dateAdded: today(),
        configName: options.configName || "",
        scrapeRunId: options.scrapeRunId,
        provider: options.provider,
        selectedForAnalysis: options.selectedForAnalysis ?? false,
        duration: reel.durationSeconds,
        videoFileUrl: reel.videoFileUrl,
        viralityScore: options.viralityScore ?? 0,
        rankingReason: options.rankingReason ?? "",
        scoreBreakdownJson: stringifyJson(options.scoreBreakdown ?? {}),
        rawProviderPayloadJson: stringifyJson(redactSensitive(reel.rawProviderPayload ?? {})),
      };
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.insert(pg.videos).values(values).onConflictDoUpdate({
          target: [pg.videos.platform, pg.videos.sourcePostUrl],
          set: {
            thumbnail: reel.thumbnailUrl,
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
          thumbnail: reel.thumbnailUrl,
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
          videoJobId: script.videoJobId,
          videoStatus: script.videoStatus,
          videoUrl: script.videoUrl,
          geminiCheck: script.geminiCheck,
          claudeCheck: script.claudeCheck,
          imagePrompt: script.imagePrompt,
          videoPrompt: script.videoPrompt,
          avatarId: script.avatarId,
          generatedImageUrl: script.generatedImageUrl,
          videoMode: script.videoMode,
          videoProvider: script.videoProvider,
          sourceVideoUrl: script.sourceVideoUrl,
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
        videoJobId: script.videoJobId,
        videoStatus: script.videoStatus,
        videoUrl: script.videoUrl,
        geminiCheck: script.geminiCheck,
        claudeCheck: script.claudeCheck,
        imagePrompt: script.imagePrompt,
        videoPrompt: script.videoPrompt,
        avatarId: script.avatarId,
        generatedImageUrl: script.generatedImageUrl,
        videoMode: script.videoMode,
        videoProvider: script.videoProvider,
        sourceVideoUrl: script.sourceVideoUrl,
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
      if (isPostgresMode()) {
        const db = await getPgDrizzle();
        await db.update(pg.scripts).set({
          starred: updates.starred,
          videoJobId: updates.videoJobId,
          videoStatus: updates.videoStatus,
          videoUrl: updates.videoUrl,
          geminiCheck: updates.geminiCheck,
          claudeCheck: updates.claudeCheck,
          imagePrompt: updates.imagePrompt,
          videoPrompt: updates.videoPrompt,
          avatarId: updates.avatarId,
          generatedImageUrl: updates.generatedImageUrl,
          videoMode: updates.videoMode,
          videoProvider: updates.videoProvider,
          sourceVideoUrl: updates.sourceVideoUrl,
          updatedAt: new Date().toISOString(),
        }).where(eq(pg.scripts.id, id));
        return (await this.list()).find((s) => s.id === id);
      }
      ensureSqlite().update(sqlite.scripts).set({
        starred: updates.starred,
        videoJobId: updates.videoJobId,
        videoStatus: updates.videoStatus,
        videoUrl: updates.videoUrl,
        geminiCheck: updates.geminiCheck,
        claudeCheck: updates.claudeCheck,
        imagePrompt: updates.imagePrompt,
        videoPrompt: updates.videoPrompt,
        avatarId: updates.avatarId,
        generatedImageUrl: updates.generatedImageUrl,
        videoMode: updates.videoMode,
        videoProvider: updates.videoProvider,
        sourceVideoUrl: updates.sourceVideoUrl,
        updatedAt: new Date().toISOString(),
      }).where(eq(sqlite.scripts.id, id)).run();
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
};

export async function closeDbForTests() {
  const { closeDbForTests: closeSqlite } = await import("./client");
  closeSqlite();
  const { closePgForTests } = await import("./client-pg");
  await closePgForTests();
}
