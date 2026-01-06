import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
  parseDuration,
  parseSeeking,
  parseBoolean,
} from './base.extractor.js';

export interface ViewDetails {
  view_id: string;
  started_at: string | null;
  ended_at: string | null;
  playing_time_seconds: number | null;
  content_playing_time_seconds: number | null;
  seeking_count: number | null;
  seeking_duration_seconds: number | null;
  exited_before_video_start: boolean | null;
  view_has_ad: boolean | null;
  video_startup_failure: boolean | null;
  view_dropped: boolean | null;
}

export async function extractViewDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<ViewDetails | null> {
  const block = findMetricsBlock(page, 'View');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`View block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  const seekingRaw = await extractor.getText('Seeking');
  const seeking = parseSeeking(seekingRaw);

  return {
    view_id: viewId,
    started_at: await extractor.getText('Started at'),
    ended_at: await extractor.getText('Ended at'),
    playing_time_seconds: parseDuration(await extractor.getText('Playing Time')),
    content_playing_time_seconds: parseDuration(
      await extractor.getText('Content Playing Time')
    ),
    seeking_count: seeking.count,
    seeking_duration_seconds: seeking.duration,
    exited_before_video_start: parseBoolean(
      await extractor.getText('Exited Before Video Start')
    ),
    view_has_ad: parseBoolean(await extractor.getText('View Has Ad')),
    video_startup_failure: parseBoolean(
      await extractor.getText('Video Startup Failure')
    ),
    view_dropped: parseBoolean(await extractor.getText('View Dropped')),
  };
}
