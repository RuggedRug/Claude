import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface AdsMetrics {
  view_id: string;
  ad_playing_time_seconds: number | null;
  preroll_requested: boolean | null;
  preroll_played: boolean | null;
  ad_attempts: number | null;
  ad_impressions: number | null;
  ad_breaks: number | null;
  ad_error_percentage: number | null;
  ad_breaks_with_error_percentage: number | null;
  ad_startup_error_percentage: number | null;
  ad_exits_before_start: number | null;
  ad_exits_before_start_percentage: number | null;
}

export async function extractAdsMetrics(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<AdsMetrics | null> {
  const block = findMetricsBlock(page, 'Ads');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Ads block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    ad_playing_time_seconds: await extractor.getNumber('Ad Playing Time'),
    preroll_requested: await extractor.getBoolean('Preroll Requested'),
    preroll_played: await extractor.getBoolean('Preroll Played'),
    ad_attempts: await extractor.getNumber('Ad Attempts'),
    ad_impressions: await extractor.getNumber('Ad Impressions'),
    ad_breaks: await extractor.getNumber('Ad Breaks'),
    ad_error_percentage: await extractor.getNumber('Ad Error Percentage'),
    ad_breaks_with_error_percentage: await extractor.getNumber(
      'Ad Breaks With Error Percentage'
    ),
    ad_startup_error_percentage: await extractor.getNumber(
      'Ad Startup Error Percentage'
    ),
    ad_exits_before_start: await extractor.getNumber('Ad Exits Before Start'),
    ad_exits_before_start_percentage: await extractor.getNumber(
      'Ad Exits Before Start Percentage'
    ),
  };
}
