"use client";

import { useState } from "react";
import { Instagram, Music2, Youtube } from "lucide-react";

/**
 * Returns a deterministic gradient color pair based on a string seed.
 * Same input always produces the same gradient — feels intentional, not random.
 */
function gradientFromSeed(seed: string): { from: string; to: string; text: string } {
  // Curated palette — every gradient picks a complementary text color
  const palettes: Array<{ from: string; to: string; text: string }> = [
    { from: "#06B6D4", to: "#0891B2", text: "#FFFFFF" }, // cyan
    { from: "#8B5CF6", to: "#6D28D9", text: "#FFFFFF" }, // purple
    { from: "#EC4899", to: "#BE185D", text: "#FFFFFF" }, // pink
    { from: "#F59E0B", to: "#D97706", text: "#0a0a0a" }, // amber
    { from: "#10B981", to: "#059669", text: "#0a0a0a" }, // emerald
    { from: "#EF4444", to: "#B91C1C", text: "#FFFFFF" }, // red
    { from: "#3B82F6", to: "#1D4ED8", text: "#FFFFFF" }, // blue
    { from: "#A855F7", to: "#7E22CE", text: "#FFFFFF" }, // violet
    { from: "#F97316", to: "#C2410C", text: "#FFFFFF" }, // orange
    { from: "#14B8A6", to: "#0F766E", text: "#FFFFFF" }, // teal
    { from: "#84CC16", to: "#4D7C0F", text: "#0a0a0a" }, // lime
    { from: "#0EA5E9", to: "#0369A1", text: "#FFFFFF" }, // sky
    { from: "#F43F5E", to: "#9F1239", text: "#FFFFFF" }, // rose
    { from: "#6366F1", to: "#3730A3", text: "#FFFFFF" }, // indigo
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return palettes[Math.abs(hash) % palettes.length];
}

function getInitials(name: string): string {
  const cleaned = name.replace(/^@/, "").replace(/[._-]/g, " ").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (cleaned.length >= 2) return cleaned.slice(0, 2).toUpperCase();
  return cleaned.toUpperCase() || "?";
}

interface AvatarPlaceholderProps {
  /** Name/username used both for initials and for picking a deterministic gradient. */
  name: string;
  /** Optional URL — if it loads, it overrides the placeholder. */
  src?: string | null;
  /** Avatar size in pixels (square). */
  size?: number;
  /** Show a small platform badge in the bottom-right. */
  platform?: "instagram" | "tiktok" | "youtube_shorts";
  /** Use a square shape instead of rounded full. */
  square?: boolean;
  className?: string;
}

export function AvatarPlaceholder({
  name,
  src,
  size = 48,
  platform,
  square,
  className,
}: AvatarPlaceholderProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = src && !imageFailed;
  const palette = gradientFromSeed(name);
  const initials = getInitials(name);
  const fontSize = Math.max(10, Math.round(size * 0.38));
  const radius = square ? `${Math.round(size * 0.18)}px` : "9999px";

  const proxiedSrc = src && src.startsWith("http") ? `/api/proxy-image?url=${encodeURIComponent(src)}` : src || "";

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/[0.08] ${className || ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: showImage
          ? "transparent"
          : `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedSrc}
          alt={name}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-bold tracking-tight select-none"
          style={{ color: palette.text, fontSize }}
        >
          {initials}
        </div>
      )}

      {platform && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-white/[0.12] bg-black/85 text-neon"
          style={{ width: Math.max(14, size * 0.34), height: Math.max(14, size * 0.34) }}
        >
          <PlatformIcon platform={platform} className="text-neon" style={{ width: size * 0.18, height: size * 0.18 }} />
        </span>
      )}
    </div>
  );
}

function PlatformIcon({
  platform,
  className,
  style,
}: {
  platform: "instagram" | "tiktok" | "youtube_shorts";
  className?: string;
  style?: React.CSSProperties;
}) {
  if (platform === "tiktok") return <Music2 className={className} style={style} />;
  if (platform === "youtube_shorts") return <Youtube className={className} style={style} />;
  return <Instagram className={className} style={style} />;
}

/**
 * Same idea but for video thumbnails — produces a 9:16 placeholder with
 * a deterministic gradient and the creator handle prominently displayed.
 * Falls back from broken images automatically.
 */
export function VideoThumbnail({
  src,
  creator,
  alt,
  className,
}: {
  src?: string | null;
  creator: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  const palette = gradientFromSeed(creator);
  const handle = creator.replace(/^@/, "");

  const resolvedSrc = src && src.startsWith("/")
    ? src
    : src
      ? `/api/proxy-image?url=${encodeURIComponent(src)}`
      : "";

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className || ""}`}
      style={{
        background: showImage
          ? "transparent"
          : `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedSrc}
          alt={alt || `@${creator}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
          <div
            className="text-[40px] font-black tracking-tight leading-none drop-shadow-md"
            style={{ color: palette.text }}
          >
            @{handle.length > 14 ? handle.slice(0, 12) + "…" : handle}
          </div>
          <div
            className="mt-2 text-[11px] uppercase tracking-[0.2em] font-semibold opacity-70"
            style={{ color: palette.text }}
          >
            Preview unavailable
          </div>
        </div>
      )}
    </div>
  );
}
