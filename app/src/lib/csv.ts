import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { Config, Creator, Video, VoiceProfile, Script, PromptLibrary } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readCsv<T>(filename: string): T[] {
  const filepath = path.join(DATA_DIR, filename);
  if (!existsSync(filepath)) return [];
  const content = readFileSync(filepath, "utf-8");
  if (!content.trim()) return [];
  return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true }) as T[];
}

function writeCsv(filename: string, data: Record<string, unknown>[], columns: string[]) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  const output = stringify(data, { header: true, columns });
  writeFileSync(filepath, output, "utf-8");
}

// Configs
const CONFIG_COLUMNS = ["id", "configName", "creatorsCategory", "analysisInstruction", "newConceptsInstruction"];

export function readConfigs(): Config[] {
  return readCsv<Config>("configs.csv");
}

export function writeConfigs(configs: Config[]) {
  writeCsv("configs.csv", configs as unknown as Record<string, unknown>[], CONFIG_COLUMNS);
}

// Creators
const CREATOR_COLUMNS = ["id", "platform", "username", "category", "profilePicUrl", "followers", "reelsCount30d", "avgViews30d", "lastScrapedAt"];

export function readCreators(): Creator[] {
  const raw = readCsv<Record<string, string>>("creators.csv");
  return raw.map((r) => {
    const rawPlatform = (r.platform || "").toLowerCase();
    const platform: Creator["platform"] = rawPlatform === "tiktok" || rawPlatform === "youtube_shorts"
      ? (rawPlatform as Creator["platform"])
      : "instagram";
    return {
      id: r.id || "",
      platform,
      username: r.username || "",
      category: r.category || "",
      profilePicUrl: r.profilePicUrl || "",
      followers: parseInt(r.followers || "0", 10) || 0,
      reelsCount30d: parseInt(r.reelsCount30d || "0", 10) || 0,
      avgViews30d: parseInt(r.avgViews30d || "0", 10) || 0,
      lastScrapedAt: r.lastScrapedAt || "",
    };
  });
}

export function writeCreators(creators: Creator[]) {
  writeCsv("creators.csv", creators as unknown as Record<string, unknown>[], CREATOR_COLUMNS);
}

// Videos
const VIDEO_COLUMNS = ["id", "link", "thumbnail", "creator", "views", "likes", "comments", "analysis", "newConcepts", "datePosted", "dateAdded", "configName", "starred", "duration", "videoFileUrl", "transcript"];

export function readVideos(): Video[] {
  const raw = readCsv<Record<string, string>>("videos.csv");
  return raw.map((r) => ({
    id: r.id || "",
    link: r.link || r.Link || "",
    thumbnail: r.thumbnail || r.Thumbnail || "",
    creator: r.creator || r.Creator || "",
    views: parseInt(r.views || r.Views || "0", 10) || 0,
    likes: parseInt(r.likes || r.Likes || "0", 10) || 0,
    comments: parseInt(r.comments || r.Comments || "0", 10) || 0,
    analysis: r.analysis || r.Analysis || "",
    newConcepts: r.newConcepts || r["newConcepts"] || r["New Concepts"] || "",
    datePosted: r.datePosted || r["Date Posted"] || r["datePosted"] || "",
    dateAdded: r.dateAdded || r["Date Added"] || r["dateAdded"] || "",
    configName: r.configName || r["Config Name"] || r["configName"] || "",
    starred: r.starred === "true",
    duration: r.duration ? parseInt(r.duration, 10) || undefined : undefined,
    videoFileUrl: r.videoFileUrl || undefined,
    transcript: r.transcript || undefined,
  }));
}

export function writeVideos(videos: Video[]) {
  writeCsv("videos.csv", videos as unknown as Record<string, unknown>[], VIDEO_COLUMNS);
}

export function appendVideo(video: Video) {
  const videos = readVideos();
  videos.push(video);
  writeVideos(videos);
}

export function updateVideo(id: string, updates: Partial<Video>) {
  const videos = readVideos();
  const idx = videos.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error(`Video not found: ${id}`);
  videos[idx] = { ...videos[idx], ...updates };
  writeVideos(videos);
  return videos[idx];
}

// ─── Voice Profile ─────────────────────────────────────────────────────────────
const VOICE_PROFILE_FILE = path.join(process.cwd(), "..", "data", "voice-profile.json");

export function readVoiceProfile(): VoiceProfile | null {
  if (!existsSync(VOICE_PROFILE_FILE)) return null;
  try {
    const raw = readFileSync(VOICE_PROFILE_FILE, "utf-8");
    return JSON.parse(raw) as VoiceProfile;
  } catch {
    return null;
  }
}

export function writeVoiceProfile(profile: VoiceProfile) {
  ensureDataDir();
  writeFileSync(VOICE_PROFILE_FILE, JSON.stringify(profile, null, 2), "utf-8");
}

// ─── Scripts ───────────────────────────────────────────────────────────────────
const SCRIPT_COLUMNS = [
  "id", "videoId", "videoCreator", "videoViews", "videoLink",
  "title", "hook", "script", "platform", "estimatedDuration",
  "contentType", "dateGenerated", "starred",
  "videoJobId", "videoStatus", "videoUrl", "geminiCheck", "claudeCheck",
  "imagePrompt", "videoPrompt",
  "avatarId", "generatedImageUrl", "videoMode", "videoProvider",
  "sourceVideoUrl",
];

export function readScripts(): Script[] {
  const raw = readCsv<Record<string, string>>("scripts.csv");
  return raw.map((r) => ({
    id: r.id || "",
    videoId: r.videoId || "",
    videoCreator: r.videoCreator || "",
    videoViews: parseInt(r.videoViews || "0", 10) || 0,
    videoLink: r.videoLink || "",
    title: r.title || "",
    hook: r.hook || "",
    script: r.script || "",
    platform: r.platform || "instagram",
    estimatedDuration: r.estimatedDuration || "",
    contentType: r.contentType || "",
    dateGenerated: r.dateGenerated || "",
    starred: r.starred === "true",
    videoJobId: r.videoJobId || undefined,
    videoStatus: (r.videoStatus as Script["videoStatus"]) || undefined,
    videoUrl: r.videoUrl || undefined,
    geminiCheck: r.geminiCheck || undefined,
    claudeCheck: r.claudeCheck || undefined,
    imagePrompt: r.imagePrompt || undefined,
    videoPrompt: r.videoPrompt || undefined,
    avatarId: r.avatarId || undefined,
    generatedImageUrl: r.generatedImageUrl || undefined,
    videoMode: (r.videoMode as Script["videoMode"]) || undefined,
    videoProvider: (r.videoProvider as Script["videoProvider"]) || undefined,
    sourceVideoUrl: r.sourceVideoUrl || undefined,
  }));
}

export function writeScripts(scripts: Script[]) {
  writeCsv("scripts.csv", scripts as unknown as Record<string, unknown>[], SCRIPT_COLUMNS);
}

export function appendScript(script: Script) {
  const scripts = readScripts();
  scripts.push(script);
  writeScripts(scripts);
}

export function updateScript(id: string, updates: Partial<Script>) {
  const scripts = readScripts();
  const idx = scripts.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error(`Script not found: ${id}`);
  scripts[idx] = { ...scripts[idx], ...updates };
  writeScripts(scripts);
  return scripts[idx];
}

// ─── Prompt Library ────────────────────────────────────────────────────────────
const PROMPT_LIBRARY_FILE = path.join(process.cwd(), "..", "data", "prompt-library.json");

export function readPromptLibrary(): PromptLibrary | null {
  if (!existsSync(PROMPT_LIBRARY_FILE)) return null;
  try {
    return JSON.parse(readFileSync(PROMPT_LIBRARY_FILE, "utf-8")) as PromptLibrary;
  } catch {
    return null;
  }
}

export function writePromptLibrary(library: PromptLibrary) {
  ensureDataDir();
  writeFileSync(PROMPT_LIBRARY_FILE, JSON.stringify(library, null, 2), "utf-8");
}
