import type { ProviderErrorCode } from "@/lib/types";

export class ProviderError extends Error {
  code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

export function classifyProviderError(error: unknown): ProviderErrorCode {
  if (error instanceof ProviderError) return error.code;
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = typeof raw === "string" ? raw.toLowerCase() : "";
  if (message.includes("token") || message.includes("unauthorized") || message.includes("login")) return "PROVIDER_AUTH";
  if (message.includes("rate") || message.includes("429")) return "RATE_LIMIT";
  if (message.includes("expired") || message.includes("cdn")) return "MEDIA_EXPIRED";
  // "Unable to download API page" is a yt-dlp channel listing issue, not a private video
  if (message.includes("unable to download api page")) return "UNKNOWN";
  if (message.includes("private") || message.includes("deleted") || message.includes("404")) return "PRIVATE_OR_DELETED";
  if (message.includes("schema") || message.includes("json") || message.includes("no json object")) return "AI_SCHEMA_INVALID";
  if (message.includes("gemini") || message.includes("ollama") || message.includes("claude")) return "AI_PROVIDER_ERROR";
  if (message.includes("invalid") || message.includes("required")) return "VALIDATION_ERROR";
  if (message.includes("fetch failed") || message.includes("econnreset") || message.includes("timeout") || message.includes("econnrefused") || message.includes("abort")) return "RATE_LIMIT";
  return "UNKNOWN";
}
