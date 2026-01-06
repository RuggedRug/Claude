import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface VideoMetadata {
  view_id: string;
  video_title: string | null;
  video_series: string | null;
  video_id: string | null;
  content_type: string | null;
}

export async function extractVideoMetadata(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<VideoMetadata | null> {
  const block = findMetricsBlock(page, 'Video Metadata');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Video Metadata block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    video_title: await extractor.getText('Video Title'),
    video_series: await extractor.getText('Video Series'),
    video_id: await extractor.getText('Video ID'),
    content_type: await extractor.getText('Content Type'),
  };
}
