export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function redactSensitive(value: unknown): unknown {
  const text = JSON.stringify(value ?? {});
  return JSON.parse(
    text.replace(
      /("(?:token|apiKey|api_key|authorization|cookie|cookies|access_token|key)"\s*:\s*")([^"]+)(")/gi,
      "$1[redacted]$3"
    )
  );
}
