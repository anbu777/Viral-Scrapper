import { repo } from "@/db/repositories";
import { getProviderForPlatform } from "@/lib/providers";

export const maxDuration = 300;

export async function POST(request: Request) {
  let body: { ids?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body OK — refresh all */
  }
  const ids: string[] = body.ids || [];

  const creators = await repo.creators.list();
  const toRefresh = ids.length > 0
    ? creators.filter((c) => ids.includes(c.id))
    : creators;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const creator of toRefresh) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "progress", username: creator.username, status: "scraping", platform: creator.platform })}\n\n`)
          );

          const provider = getProviderForPlatform(creator.platform || "instagram");
          const stats = await provider.scrapeCreatorStats(creator.username);
          await repo.creators.update(creator.id, {
            profilePicUrl: stats.profilePicUrl,
            followers: stats.followers,
            reelsCount30d: stats.reelsCount30d,
            avgViews30d: stats.avgViews30d,
            lastScrapedAt: new Date().toISOString(),
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "progress", username: creator.username, status: "done", stats })}\n\n`)
          );
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", username: creator.username, error: err instanceof Error ? err.message : "Unknown" })}\n\n`)
          );
        }
      }
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "complete" })}\n\n`)
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
