import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface StartupTimeMetrics {
  view_id: string;
  startup_time_score: number | null;
  video_startup_time: number | null;
  content_startup_time: number | null;
  player_start_time: number | null;
  seek_latency_avg: number | null;
  seek_count: number | null;
  seek_duration: number | null;
}

export async function extractStartupTimeMetrics(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<StartupTimeMetrics | null> {
  // The block can be titled "Startup Time" or "Startup / Seek"
  const block = findMetricsBlock(page, 'Startup');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Startup block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    startup_time_score: await extractor.getNumber('Startup Time Score'),
    video_startup_time: await extractor.getNumber('Video Startup Time'),
    content_startup_time: await extractor.getNumber('Content Startup Time'),
    player_start_time: await extractor.getNumber('Player Start Time'),
    seek_latency_avg: await extractor.getNumber('Seek Latency'),
    seek_count: await extractor.getNumber('Seek Count'),
    seek_duration: await extractor.getNumber('Seek Duration'),
  };
}
