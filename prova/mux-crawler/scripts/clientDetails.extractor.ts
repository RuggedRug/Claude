import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface ClientDetails {
  view_id: string;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  os_version: string | null;
  page_type: string | null;
}

export async function extractClientDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<ClientDetails | null> {
  const block = findMetricsBlock(page, 'Client');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Client block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    browser: await extractor.getText('Browser'),
    browser_version: await extractor.getText('Browser Version'),
    os: await extractor.getText('OS'),
    os_version: await extractor.getText('OS Version'),
    page_type: await extractor.getText('Page Type'),
  };
}
