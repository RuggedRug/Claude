import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface ViewerDetails {
  view_id: string;
  viewer_id: string | null;
}

export async function extractViewerDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<ViewerDetails | null> {
  const block = findMetricsBlock(page, 'Viewer');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Viewer block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    viewer_id: await extractor.getText('Viewer ID'),
  };
}
