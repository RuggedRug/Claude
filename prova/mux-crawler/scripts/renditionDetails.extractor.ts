import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface RenditionDetails {
  view_id: string;
  initial_bitrate: string | null;
  initial_framerate: string | null;
  bitrate: string | null;
  framerate: string | null;
  video_height: number | null;
  video_width: number | null;
}

export async function extractRenditionDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<RenditionDetails | null> {
  const block = findMetricsBlock(page, 'Rendition');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Rendition block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    initial_bitrate: await extractor.getText('Initial Bitrate'),
    initial_framerate: await extractor.getText('Initial Framerate'),
    bitrate: await extractor.getText('Bitrate'),
    framerate: await extractor.getText('Framerate'),
    video_height: await extractor.getNumber('Video Height'),
    video_width: await extractor.getNumber('Video Width'),
  };
}
