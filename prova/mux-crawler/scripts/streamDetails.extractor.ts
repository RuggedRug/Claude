import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface StreamDetails {
  view_id: string;
  video_stream_type: string | null;
  source_type: string | null;
  source_url: string | null;
  duration_seconds: number | null;
  encoding_variant: string | null;
  drm_type: string | null;
}

export async function extractStreamDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<StreamDetails | null> {
  const block = findMetricsBlock(page, 'Stream');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Stream block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    video_stream_type: await extractor.getText('Video Stream Type'),
    source_type: await extractor.getText('Source Type'),
    source_url: await extractor.getText('Source URL'),
    duration_seconds: await extractor.getNumber('Duration'),
    encoding_variant: await extractor.getText('Encoding Variant'),
    drm_type: await extractor.getText('DRM Type'),
  };
}
