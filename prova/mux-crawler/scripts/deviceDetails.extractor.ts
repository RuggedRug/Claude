import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface DeviceDetails {
  view_id: string;
  device_name: string | null;
  device_model: string | null;
  device_category: string | null;
  device_brand: string | null;
  full_user_agent: string | null;
}

export async function extractDeviceDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<DeviceDetails | null> {
  const block = findMetricsBlock(page, 'Device');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Device block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    device_name: await extractor.getText('Device Name'),
    device_model: await extractor.getText('Device Model'),
    device_category: await extractor.getText('Device Category'),
    device_brand: await extractor.getText('Device Brand'),
    full_user_agent: await extractor.getText('Full User Agent'),
  };
}
