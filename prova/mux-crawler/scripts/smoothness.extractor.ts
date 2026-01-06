import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface SmoothnessMetrics {
  view_id: string;
  smoothness_score: number | null;
  rebuffer_frequency: number | null;
  rebuffer_duration: number | null;
  rebuffer_count: number | null;
  rendition_change_count: number | null;
  rendition_upshift_count: number | null;
  rendition_downshift_count: number | null;
}

export async function extractSmoothnessMetrics(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<SmoothnessMetrics | null> {
  const block = findMetricsBlock(page, 'Smoothness');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Smoothness block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    smoothness_score: await extractor.getNumber('Smoothness Score'),
    rebuffer_frequency: await extractor.getNumber('Rebuffer Frequency'),
    rebuffer_duration: await extractor.getNumber('Rebuffer Duration'),
    rebuffer_count: await extractor.getNumber('Rebuffer Count'),
    rendition_change_count: await extractor.getNumber('Rendition Change Count'),
    rendition_upshift_count: await extractor.getNumber('Rendition Upshift Count'),
    rendition_downshift_count: await extractor.getNumber('Rendition Downshift Count'),
  };
}

/**
 * Fallback extraction for rendition shift counts from Video Quality block
 */
export async function extractRenditionShiftFallback(
  page: Page
): Promise<{ rendition_upshift_count: number | null; rendition_downshift_count: number | null } | null> {
  const block = findMetricsBlock(page, 'Video Quality Metrics');

  if (!(await waitForBlock(block, 8000))) {
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    rendition_upshift_count: await extractor.getNumber('Upshift'),
    rendition_downshift_count: await extractor.getNumber('Downshift'),
  };
}
