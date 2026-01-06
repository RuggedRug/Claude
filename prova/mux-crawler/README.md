# Mux Dashboard Crawler

A Playwright-based tool for extracting video analytics metrics from the Mux dashboard and storing them in PostgreSQL.

## Features

- Automated extraction of all view metrics from Mux dashboard
- Checkpoint-based resume capability (survives interruptions)
- Automatic retry of failed extractions
- Backfill support for historical data
- PostgreSQL storage with optimized schema

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Mux dashboard account with access to analytics

## Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your configuration:
```env
# Database
DATABASE_URL=postgres://user:password@localhost:5432/analytics

# Mux Configuration
MUX_ORG_ID=your_org_id
MUX_ENV_ID=your_env_id
MUX_USER_ID=optional_user_filter

# Extraction start date
EXTRACTION_START_DATE=2024-10-01
```

3. Set up the database:
```bash
psql -d analytics -f schema.sql
```

## Usage

### First Run (Authentication)

On first run, the tool will open a browser for manual login:

```bash
npm run test:headed
```

1. Enter your Mux dashboard credentials
2. Complete any MFA verification
3. The session will be saved to `auth/auth.json`

### Running Extraction

```bash
# Run in headless mode (recommended)
npm run extract

# Run with visible browser
npm run test:headed

# Debug mode with Playwright inspector
npm run test:debug
```

### How It Works

1. **Phase 1 - Retry**: Retries any previously failed view extractions
2. **Phase 2 - Forward**: Extracts from last checkpoint to current date
3. **Phase 3 - Backfill**: Extracts historical data back to start date

The extraction saves checkpoints after each day, so it can safely resume if interrupted.

## Extracted Metrics

| Category | Metrics |
|----------|---------|
| View | Start/end time, playing time, seeking stats |
| Startup | Startup time score, video/content startup time |
| Smoothness | Rebuffer frequency/duration/count, rendition changes |
| Video Quality | Quality score, upscale/downscale %, bitrate |
| Device | Name, model, category, brand, user agent |
| Client | Browser, OS, page type |
| Player | Name, version, dimensions, Mux plugin |
| Stream | Type, source, duration, DRM |
| Network | CDN, ASN, connection type |
| Geography | Country, continent, city, region |
| Ads | Playing time, attempts, impressions, errors |

## Database Schema

See `schema.sql` for the complete database schema. Key tables:

- `views` - Core view information
- `startup_time_metrics` - Startup performance
- `smoothness_metrics` - Playback smoothness
- `video_quality_metrics` - Video quality scores
- `view_ingestion_status` - Extraction status tracking

## Troubleshooting

### Session Expired
Delete `auth/auth.json` and run with `--headed` to re-authenticate.

### Extraction Stuck
Check `view_ingestion_status` table for failed views:
```sql
SELECT * FROM view_ingestion_status WHERE status = 'FAILED';
```

### Reset Checkpoint
```sql
DELETE FROM backfill_checkpoint;
```

## Project Structure

```
mux-crawler/
├── auth/              # Authentication files
├── scripts/           # Metric extractors
├── tests/             # Playwright test specs
├── utils/             # Database & helper utilities
├── playwright.config.ts
├── schema.sql
└── package.json
```
