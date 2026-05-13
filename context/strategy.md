# Strategy

## Current Status

The tool is implemented as a Next.js local app with the core workflow in place:
- Pipeline: scrape, filter, rank, analyze with Gemini, and generate scripts/concepts via the active AI provider.
- UI: Dashboard, Videos browser, Run page, Configs CRUD, Creators CRUD, Scripts, Voice Profile, and Settings.
- Storage: SQLite/Postgres repository layer is the source of truth. CSV files remain legacy data/import references only.
- Current local setup: Gemini and Apify keys are present; fal.ai, Anthropic, Telegram, Whisper, and Ollama are not configured.
- Instagram pipeline runs should use the Run page Apify selector when new scraping is required. Manual mode only works with already imported/saved videos.
- Multi-platform pipeline selection is category-based: add TikTok/YouTube Shorts creators to the same category used by the config to include them in that run.
- Gemini currently returns HTTP 429 quota errors locally, so analysis/transcript/script generation is intentionally blocked from saving fallback content until quota/key configuration is fixed.

## Next Steps

- Test pipeline end-to-end with real API calls, including one live Apify scrape when credits are acceptable.
- Improve error handling and retry logic for API failures
- Add more advanced filtering and sorting to the Videos page
- Configure `FAL_KEY`, Telegram bot settings, and avatar assets before testing full video generation.
- Review dependency audit findings before production use.
- Add at least one YouTube Shorts creator and a resolvable TikTok creator/URL to the `finance` category before expecting `Crypto Finance Global` to scrape non-Instagram sources.
