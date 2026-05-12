import { existsSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextResponse } from "next/server";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { getEnv, getEnvReport, getSqlitePath, isPostgresDatabaseUrl } from "@/lib/env";
import { getInstagramProvider } from "@/lib/providers";
import { migrateDb } from "@/db/migrate";
import { getPgDrizzle } from "@/db/client-pg";
import { pingGemini } from "@/lib/gemini";

const execFileAsync = promisify(execFile);

async function commandHealth(command: string, args: string[] = ["--version"]) {
  try {
    await execFileAsync(command, args, { timeout: 10_000 });
    return { ok: true, message: `${command} is available.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : `${command} unavailable.` };
  }
}

export async function GET() {
  const env = getEnv();
  const provider = getInstagramProvider(env.SCRAPER_PROVIDER);
  const database = await (async () => {
    try {
      if (isPostgresDatabaseUrl(env.DATABASE_URL)) {
        await getPgDrizzle();
        return { ok: true, message: "Postgres (Supabase) connection OK." };
      }
      migrateDb();
      return { ok: true, message: `SQLite ready at ${getSqlitePath()}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Database error" };
    }
  })();

  const geminiPing = env.GEMINI_API_KEY ? await pingGemini() : { ok: false, message: "Gemini key missing." };

  const checks = {
    env: { ok: true, ...getEnvReport() },
    database,
    ffmpeg: existsSync(ffmpegPath.path)
      ? { ok: true, message: `ffmpeg bundled at ${ffmpegPath.path}` }
      : { ok: false, message: "Bundled ffmpeg not found." },
    playwright: await provider.validateSession(),
    ytDlp: await commandHealth("yt-dlp"),
    whisper: await commandHealth(process.env.WHISPER_COMMAND || "whisper"),
    ollama: await fetch(`${env.OLLAMA_BASE_URL}/api/tags`).then(
      (res) => ({ ok: res.ok, message: res.ok ? "Ollama is reachable (optional)." : `Ollama returned ${res.status}` }),
      (error) => ({ ok: false, message: error instanceof Error ? error.message : "Ollama unavailable" })
    ),
    apify: { ok: Boolean(env.APIFY_API_TOKEN), message: env.APIFY_API_TOKEN ? "Apify token configured." : "Apify token missing." },
    gemini: { ok: geminiPing.ok, message: geminiPing.ok ? "Gemini API reachable." : geminiPing.message },
    claude: { ok: Boolean(env.ANTHROPIC_API_KEY), message: env.ANTHROPIC_API_KEY ? "Claude key configured." : "Claude key missing." },
    fal: { ok: Boolean(env.FAL_KEY), message: env.FAL_KEY ? "fal.ai key configured." : "fal.ai key missing." },
    telegram: {
      ok: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
      message: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? "Telegram configured." : "Telegram bot/chat missing.",
    },
    freeCloudProfile: {
      ok: env.TRANSCRIPT_PROVIDER === "gemini",
      message: "TRANSCRIPT_PROVIDER=gemini avoids local Whisper+ffmpeg (better for low-spec PCs).",
    },
  };
  return NextResponse.json(checks);
}
