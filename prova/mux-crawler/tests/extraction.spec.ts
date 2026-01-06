import { test, Page } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Database functions
import {
  isViewAlreadyProcessed,
  markViewStatus,
  getFailedViews,
  getCheckpoint,
  saveCheckpoint,
  insertViewDetails,
  insertStartupTimeMetrics,
  insertSmoothnessMetrics,
  insertVideoQualityMetrics,
  insertDeviceDetails,
  insertClientDetails,
  insertPlayerDetails,
  insertOrganizationDetails,
  insertVideoMetadata,
  insertStreamDetails,
  insertPlaybackDetails,
  insertRenditionDetails,
  insertViewerDetails,
  insertNetworkDetails,
  insertGeographyDetails,
  insertAdsMetrics,
  insertCustomDetails,
} from '../utils/db.js';

// Extractors
import { extractViewDetails } from '../scripts/viewDetails.extractor.js';
import { extractStartupTimeMetrics } from '../scripts/startupTime.extractor.js';
import { extractSmoothnessMetrics, extractRenditionShiftFallback } from '../scripts/smoothness.extractor.js';
import { extractVideoQualityMetrics } from '../scripts/videoQuality.extractor.js';
import { extractDeviceDetails } from '../scripts/deviceDetails.extractor.js';
import { extractClientDetails } from '../scripts/clientDetails.extractor.js';
import { extractPlayerDetails } from '../scripts/playerDetails.extractor.js';
import { extractOrganizationDetails } from '../scripts/organizationDetails.extractor.js';
import { extractVideoMetadata } from '../scripts/videoMetadata.extractor.js';
import { extractStreamDetails } from '../scripts/streamDetails.extractor.js';
import { extractPlaybackDetails } from '../scripts/playbackDetails.extractor.js';
import { extractRenditionDetails } from '../scripts/renditionDetails.extractor.js';
import { extractViewerDetails } from '../scripts/viewerDetails.extractor.js';
import { extractNetworkDetails } from '../scripts/networkDetails.extractor.js';
import { extractGeographyDetails } from '../scripts/geography.extractor.js';
import { extractAdsMetrics } from '../scripts/ads.extractor.js';
import { extractCustomDetails } from '../scripts/customDetails.extractor.js';

// Utilities
import {
  extractAllViewIds,
  waitForViewPageReady,
  buildViewsListUrl,
  buildViewDetailUrl,
} from '../utils/viewHelper.js';

// Configuration from environment
const ORG_ID = process.env.MUX_ORG_ID || 'g4m6v6';
const ENV_ID = process.env.MUX_ENV_ID || '4l0u8v';
const USER_ID = process.env.MUX_USER_ID || '';
const START_DATE = new Date(process.env.EXTRACTION_START_DATE || '2024-10-01');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toUnix(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

// ============================================================
// VIEW PROCESSOR
// ============================================================

async function processSingleView(page: Page, viewId: string): Promise<void> {
  // Skip already processed views
  if (await isViewAlreadyProcessed(viewId)) {
    console.log(`  Skipping ${viewId} (already processed)`);
    return;
  }

  try {
    await markViewStatus(viewId, 'PROCESSING');

    // Navigate to view detail page
    const detailUrl = buildViewDetailUrl(ORG_ID, ENV_ID, viewId);
    await page.goto(detailUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });

    // Wait for page to be ready
    await waitForViewPageReady(page);

    // Extract and insert all metrics
    const view = await extractViewDetails(page, viewId);
    if (view) await insertViewDetails(view);

    const startup = await extractStartupTimeMetrics(page, viewId);
    if (startup) await insertStartupTimeMetrics(startup);

    let smooth = await extractSmoothnessMetrics(page, viewId);
    if (smooth) {
      // Try fallback for rendition shift counts if missing
      if (smooth.rendition_upshift_count == null || smooth.rendition_downshift_count == null) {
        const fallback = await extractRenditionShiftFallback(page);
        if (fallback) {
          smooth.rendition_upshift_count ??= fallback.rendition_upshift_count;
          smooth.rendition_downshift_count ??= fallback.rendition_downshift_count;
        }
      }
      await insertSmoothnessMetrics(smooth);
    }

    const vq = await extractVideoQualityMetrics(page, viewId);
    if (vq) await insertVideoQualityMetrics(vq);

    const device = await extractDeviceDetails(page, viewId);
    if (device) await insertDeviceDetails(device);

    const client = await extractClientDetails(page, viewId);
    if (client) await insertClientDetails(client);

    const player = await extractPlayerDetails(page, viewId);
    if (player) await insertPlayerDetails(player);

    const org = await extractOrganizationDetails(page, viewId);
    if (org) await insertOrganizationDetails(org);

    const meta = await extractVideoMetadata(page, viewId);
    if (meta) await insertVideoMetadata(meta);

    const stream = await extractStreamDetails(page, viewId);
    if (stream) await insertStreamDetails(stream);

    const playback = await extractPlaybackDetails(page, viewId);
    if (playback) await insertPlaybackDetails(playback);

    const viewer = await extractViewerDetails(page, viewId);
    if (viewer) await insertViewerDetails(viewer);

    const net = await extractNetworkDetails(page, viewId);
    if (net) await insertNetworkDetails(net);

    const geo = await extractGeographyDetails(page, viewId);
    if (geo) await insertGeographyDetails(geo);

    const ads = await extractAdsMetrics(page, viewId);
    if (ads) await insertAdsMetrics(ads);

    const custom = await extractCustomDetails(page, viewId);
    if (custom) await insertCustomDetails(custom);

    const rend = await extractRenditionDetails(page, viewId);
    if (rend) await insertRenditionDetails(rend);

    await markViewStatus(viewId, 'SUCCESS');
    console.log(`  Successfully processed ${viewId}`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await markViewStatus(viewId, 'FAILED', errorMsg);
    console.error(`  Failed to process ${viewId}:`, errorMsg);
  }
}

// ============================================================
// WINDOW PROCESSOR
// ============================================================

async function processWindow(
  listPage: Page,
  detailPage: Page,
  start: Date,
  end: Date
): Promise<void> {
  console.log(`\nProcessing window: ${start.toDateString()} -> ${end.toDateString()}`);

  // Build URL with optional user filter
  const url = buildViewsListUrl(ORG_ID, ENV_ID, {
    userId: USER_ID || undefined,
    startUnix: toUnix(start),
    endUnix: toUnix(end),
  });

  await listPage.goto(url, { timeout: 30000 });

  // Wait for the page to load
  await listPage.waitForTimeout(3000);

  // Extract all view IDs
  let viewIds: string[] = [];
  try {
    viewIds = await extractAllViewIds(listPage);
  } catch (error) {
    console.warn('Could not extract view IDs:', error);
  }

  console.log(`Found ${viewIds.length} views`);

  // Process each view
  for (const viewId of viewIds) {
    await processSingleView(detailPage, viewId);
  }
}

// ============================================================
// MAIN EXTRACTION TEST
// ============================================================

test('Extract Mux dashboard metrics with checkpoint resume', async ({ browser }) => {
  // Disable timeout for long-running extraction
  test.setTimeout(0);

  const context = await browser.newContext({
    storageState: 'auth/auth.json',
  });

  const listPage = await context.newPage();
  const detailPage = await context.newPage();

  try {
    // PHASE 1: Retry failed views
    console.log('\n========================================');
    console.log('  PHASE 1: Retrying Failed Views');
    console.log('========================================');

    const failedViews = await getFailedViews();
    console.log(`Found ${failedViews.length} failed views to retry\n`);

    for (const viewId of failedViews) {
      await processSingleView(detailPage, viewId);
    }

    // PHASE 2: Forward extraction (checkpoint -> now)
    console.log('\n========================================');
    console.log('  PHASE 2: Forward Extraction');
    console.log('========================================');

    const checkpoint = await getCheckpoint();
    let forwardStart = startOfDay(checkpoint ?? new Date());
    let forwardEnd = addDays(forwardStart, 1);
    const now = new Date();

    console.log(`Starting from: ${forwardStart.toDateString()}`);
    console.log(`Going to: ${now.toDateString()}\n`);

    while (forwardStart < now) {
      await processWindow(listPage, detailPage, forwardStart, forwardEnd);
      await saveCheckpoint(forwardEnd);
      forwardStart = forwardEnd;
      forwardEnd = addDays(forwardStart, 1);
    }

    // PHASE 3: Backfill extraction (checkpoint -> start date)
    console.log('\n========================================');
    console.log('  PHASE 3: Backfill Extraction');
    console.log('========================================');

    const currentCheckpoint = await getCheckpoint();
    let backEnd = startOfDay(currentCheckpoint ?? new Date());
    let backStart = addDays(backEnd, -1);

    console.log(`Backfilling from: ${backEnd.toDateString()}`);
    console.log(`Going back to: ${START_DATE.toDateString()}\n`);

    while (backStart >= START_DATE) {
      await processWindow(listPage, detailPage, backStart, backEnd);
      await saveCheckpoint(backStart);
      backEnd = backStart;
      backStart = addDays(backEnd, -1);
    }

    console.log('\n========================================');
    console.log('  Extraction Complete!');
    console.log('========================================\n');

  } finally {
    await context.close();
  }
});

// ============================================================
// DEBUG TEST
// ============================================================

test.skip('Debug: Inspect single view', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: 'auth/auth.json',
  });

  const page = await context.newPage();

  // Navigate to views list
  await page.goto(buildViewsListUrl(ORG_ID, ENV_ID), {
    waitUntil: 'networkidle',
    timeout: 15000,
  });

  // Pause for manual inspection
  await page.pause();

  await context.close();
});
