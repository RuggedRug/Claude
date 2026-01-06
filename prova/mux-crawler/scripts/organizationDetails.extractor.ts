import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface OrganizationDetails {
  view_id: string;
  sub_property_id: string | null;
}

export async function extractOrganizationDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<OrganizationDetails | null> {
  const block = findMetricsBlock(page, 'Organization');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Organization block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    sub_property_id: await extractor.getText('Sub Property ID'),
  };
}
