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
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("token") || message.includes("unauthorized") || message.includes("login")) return "PROVIDER_AUTH";
  if (message.includes("rate") || message.includes("429")) return "RATE_LIMIT";
  if (message.includes("expired") || message.includes("cdn")) return "MEDIA_EXPIRED";
  if (message.includes("private") || message.includes("deleted") || message.includes("404")) return "PRIVATE_OR_DELETED";
  if (message.includes("schema") || message.includes("json")) return "AI_SCHEMA_INVALID";
  if (message.includes("gemini") || message.includes("ollama") || message.includes("claude")) return "AI_PROVIDER_ERROR";
  if (message.includes("invalid") || message.includes("required")) return "VALIDATION_ERROR";
  return "UNKNOWN";
}
