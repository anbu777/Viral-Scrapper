# Current Data

## Data Files

| File | Purpose |
|------|---------|
| SQLite/Postgres DB | Current source of truth for configs, creators, videos, scripts, pipeline runs, and video jobs |
| `data/*.csv` | Legacy local data/import references; do not treat these as the active write path |
| `app/public/thumbnails/` | Locally stored thumbnails referenced by saved videos |

## What The Pipeline Produces

Each video entry includes:
- **Metrics**: views, likes, comments
- **Analysis**: Concept, Hook, Retention Mechanisms, Reward, Script (from Gemini)
- **New Concepts**: Adapted video ideas for the target brand (from Claude)
- **Metadata**: creator, link, thumbnail, dates, config name

Scripts and video-generation statuses are also persisted in the database. The active code path should update repository records instead of CSV helper files.
