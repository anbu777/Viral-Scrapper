/**
 * Avatar utilities — read/write avatar profiles and manage reference + generated images.
 *
 * Folder structure:
 *   data/avatars/{id}/profile.json     — avatar metadata
 *   data/avatars/{id}/reference/       — master reference images (uploaded by user)
 *   data/avatars/{id}/generated/       — AI-generated images (created during video pipeline)
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import type { AvatarProfile, VoiceProfile } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const AVATARS_DIR = path.join(DATA_DIR, "avatars");

// Image extensions we recognise
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function ensureAvatarDir(id: string) {
  const base = path.join(AVATARS_DIR, id);
  mkdirSync(path.join(base, "reference"), { recursive: true });
  mkdirSync(path.join(base, "generated"), { recursive: true });
  return base;
}

// ─── Avatar CRUD ──────────────────────────────────────────────────────────────

export function listAvatars(): AvatarProfile[] {
  if (!existsSync(AVATARS_DIR)) return [];
  return readdirSync(AVATARS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const profilePath = path.join(AVATARS_DIR, e.name, "profile.json");
      if (!existsSync(profilePath)) return null;
      try {
        return JSON.parse(readFileSync(profilePath, "utf-8")) as AvatarProfile;
      } catch {
        return null;
      }
    })
    .filter((a): a is AvatarProfile => a !== null);
}

export function readAvatar(id: string): AvatarProfile | null {
  const profilePath = path.join(AVATARS_DIR, id, "profile.json");
  if (!existsSync(profilePath)) return null;
  try {
    return JSON.parse(readFileSync(profilePath, "utf-8")) as AvatarProfile;
  } catch {
    return null;
  }
}

export function writeAvatar(profile: AvatarProfile) {
  const base = ensureAvatarDir(profile.id);
  writeFileSync(path.join(base, "profile.json"), JSON.stringify(profile, null, 2), "utf-8");
}

export function createAvatar(partial: Partial<AvatarProfile> & { id: string }): AvatarProfile {
  const profile: AvatarProfile = {
    id: partial.id,
    name: partial.name ?? "New Avatar",
    gender: partial.gender ?? "female",
    niche: partial.niche ?? "",
    voiceId: partial.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "",
    createdAt: new Date().toISOString(),
  };
  writeAvatar(profile);
  return profile;
}

// ─── Per-avatar voice profiles ────────────────────────────────────────────────

export function readAvatarVoiceProfile(id: string): VoiceProfile | null {
  const p = path.join(AVATARS_DIR, id, "voice-profile.json");
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")) as VoiceProfile; } catch { return null; }
}

export function writeAvatarVoiceProfile(id: string, profile: VoiceProfile): void {
  ensureAvatarDir(id);
  writeFileSync(
    path.join(AVATARS_DIR, id, "voice-profile.json"),
    JSON.stringify(profile, null, 2),
    "utf-8"
  );
}

// ─── Reference images ─────────────────────────────────────────────────────────

export function listReferenceImages(avatarId: string): string[] {
  const refDir = path.join(AVATARS_DIR, avatarId, "reference");
  if (!existsSync(refDir)) return [];
  return readdirSync(refDir)
    .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    .sort();
}

export function readReferenceImage(avatarId: string, filename: string): Buffer {
  return readFileSync(path.join(AVATARS_DIR, avatarId, "reference", filename));
}

export function saveReferenceImage(avatarId: string, filename: string, buffer: Buffer) {
  ensureAvatarDir(avatarId);
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  writeFileSync(path.join(AVATARS_DIR, avatarId, "reference", safe), buffer);
  return safe;
}

export function deleteReferenceImage(avatarId: string, filename: string) {
  unlinkSync(path.join(AVATARS_DIR, avatarId, "reference", filename));
}

export function getReferenceImagePath(avatarId: string, filename: string): string {
  return path.join(AVATARS_DIR, avatarId, "reference", filename);
}

// ─── Generated images ─────────────────────────────────────────────────────────

export function saveGeneratedImage(avatarId: string, scriptId: string, buffer: Buffer): string {
  ensureAvatarDir(avatarId);
  const filename = `${scriptId}-${Date.now()}.jpg`;
  writeFileSync(path.join(AVATARS_DIR, avatarId, "generated", filename), buffer);
  return filename;
}

export function readGeneratedImage(avatarId: string, filename: string): Buffer {
  return readFileSync(path.join(AVATARS_DIR, avatarId, "generated", filename));
}

export function listGeneratedImages(avatarId: string): string[] {
  const genDir = path.join(AVATARS_DIR, avatarId, "generated");
  if (!existsSync(genDir)) return [];
  return readdirSync(genDir)
    .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    .sort()
    .reverse(); // most recent first
}

// ─── Fallback: legacy avatar.png ─────────────────────────────────────────────

/**
 * Returns buffer of the best available avatar image.
 * Priority: avatar-specific generated image → reference images → legacy data/avatar.png
 */
export function getAvatarFallbackBuffer(avatarId: string = "default"): Buffer | null {
  // Try reference images first
  const refs = listReferenceImages(avatarId);
  if (refs.length > 0) {
    return readReferenceImage(avatarId, refs[0]);
  }
  // Legacy fallback: data/avatar.png / avatar.jpg
  const legacyCandidates = ["avatar.png", "avatar.jpg", "avatar.jpeg", "avatar.webp"];
  for (const f of legacyCandidates) {
    const p = path.join(DATA_DIR, f);
    if (existsSync(p)) return readFileSync(p);
  }
  return null;
}
