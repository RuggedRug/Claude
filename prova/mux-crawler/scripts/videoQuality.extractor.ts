import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface VideoQualityMetrics {
  view_id: string;
  video_quality_score: number | null;
  upscale_percentage: number | null;
  downscale_percentage: number | null;
  max_upscale_percentage: number | null;
  max_downscale_percentage: number | null;
  weighted_average_bitrate: number | null;
  request_throughput: number | null;
  request_latency: number | null;
  max_request_latency: number | null;
}

export async function extractVideoQualityMetrics(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<VideoQualityMetrics | null> {
  const block = findMetricsBlock(page, 'Video Quality Metrics');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Video Quality Metrics block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    video_quality_score: await extractor.getNumber('Video Quality Score'),
    upscale_percentage: await extractor.getNumber('Upscale Percentage'),
    downscale_percentage: await extractor.getNumber('Downscale Percentage'),
    max_upscale_percentage: await extractor.getNumber('Max Upscale Percentage'),
    max_downscale_percentage: await extractor.getNumber('Max Downscale Percentage'),
    weighted_average_bitrate: await extractor.getNumber('Weighted Average Bitrate'),
    request_throughput: await extractor.getNumber('Request Throughput'),
    request_latency: await extractor.getNumber('Request Latency'),
    max_request_latency: await extractor.getNumber('Max Request Latency'),
  };
}
