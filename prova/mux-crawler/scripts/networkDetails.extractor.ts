import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface NetworkDetails {
  view_id: string;
  cdn: string | null;
  video_cdn_trace: string | null;
  asn: string | null;
  connection_type: string | null;
  source_hostname: string | null;
  view_session_id: string | null;
}

export async function extractNetworkDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<NetworkDetails | null> {
  const block = findMetricsBlock(page, 'Network');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Network block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    cdn: await extractor.getText('CDN'),
    video_cdn_trace: await extractor.getText('Video CDN Trace'),
    asn: await extractor.getText('ASN'),
    connection_type: await extractor.getText('Connection Type'),
    source_hostname: await extractor.getText('Source Hostname'),
    view_session_id: await extractor.getText('View Session ID'),
  };
}
