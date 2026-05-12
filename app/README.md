# Viral IG Scraper + AI Content System

Local-first Next.js app for collecting Instagram Reel references, ranking viral signals, analyzing content patterns, and generating AI script variants.

## What changed

- SQLite is the source of truth (`../data/app.db`), with CSV retained as an import/export source.
- Scraping is provider-based: `local`, `manual`, `apify`, and limited `meta` stub.
- Free mode defaults to local/manual scraping, Ollama analysis, Whisper transcript, and no cloud video render.
- Provider health, manual import, run history, quality scoring, and virality scoring are included.

## Setup

```bash
npm install
cp ../.env.example ../.env
npm run db:migrate
npm run dev
```

Open `http://localhost:3001`.

## Useful Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run qa
npm run db:migrate
```

## Free Mode

Set:

```env
SCRAPER_PROVIDER=local
AI_PROVIDER=ollama
TRANSCRIPT_PROVIDER=whisper-local
VIDEO_PROVIDER=none
```

Use **Manual Import** when Instagram blocks or limits local browser scraping. Local scraping is intentionally conservative and does not bypass challenges or captcha.
