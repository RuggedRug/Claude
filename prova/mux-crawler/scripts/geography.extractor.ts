import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface GeographyDetails {
  view_id: string;
  country: string | null;
  continent: string | null;
  city: string | null;
  region: string | null;
  latitude: string | null;
  longitude: string | null;
}

export async function extractGeographyDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<GeographyDetails | null> {
  const block = findMetricsBlock(page, 'Geography');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Geography block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    country: await extractor.getText('Country'),
    continent: await extractor.getText('Continent'),
    city: await extractor.getText('City'),
    region: await extractor.getText('Region'),
    latitude: await extractor.getText('Latitude'),
    longitude: await extractor.getText('Longitude'),
  };
}
