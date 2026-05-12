import { readConfigs, readCreators, readScripts, readVideos } from "@/lib/csv";
import { repo } from "@/db/repositories";
import { migrateDb } from "@/db/migrate";
import { getEnv, isPostgresDatabaseUrl } from "@/lib/env";
import { getPgDrizzle } from "@/db/client-pg";

async function main() {
  if (isPostgresDatabaseUrl(getEnv().DATABASE_URL)) {
    await getPgDrizzle();
  } else {
    migrateDb();
  }

  for (const config of readConfigs()) {
    if (config.id && config.configName) await repo.configs.upsert(config);
  }

  for (const creator of readCreators()) {
    if (creator.id && creator.username) await repo.creators.upsert(creator);
  }

  for (const video of readVideos()) {
    if (!video.id || !video.link) continue;
    await repo.videos.upsertScraped({
      platform: "instagram",
      sourcePostUrl: video.link,
      shortcode: "",
      creatorUsername: video.creator,
      caption: "",
      thumbnailUrl: video.thumbnail,
      videoFileUrl: video.videoFileUrl || null,
      postedAt: video.datePosted,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      durationSeconds: video.duration,
      rawProviderPayload: { migratedFromCsv: true },
    }, {
      id: video.id,
      configName: video.configName,
      provider: "csv-migration",
    });
    await repo.videos.update(video.id, {
      analysis: video.analysis,
      newConcepts: video.newConcepts,
      starred: video.starred,
      transcript: video.transcript,
    });
  }

  for (const script of readScripts()) {
    if (script.id) await repo.scripts.upsert(script);
  }

  console.log("CSV migration complete.");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
