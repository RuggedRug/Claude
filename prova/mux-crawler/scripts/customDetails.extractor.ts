import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface CustomDetails {
  view_id: string;
  selected_stream: string | null;
  config_name: string | null;
  ad_strategy: string | null;
  experiment_strategy: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  video_dynamic_range: string | null;
  player_index: number | null;
}

export async function extractCustomDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<CustomDetails | null> {
  const block = findMetricsBlock(page, 'Custom');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Custom block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    selected_stream: await extractor.getText('Selected Stream'),
    config_name: await extractor.getText('Config Name'),
    ad_strategy: await extractor.getText('Ad Strategy'),
    experiment_strategy: await extractor.getText('Experiment Strategy'),
    video_codec: await extractor.getText('Video Codec'),
    audio_codec: await extractor.getText('Audio Codec'),
    video_dynamic_range: await extractor.getText('Video Dynamic Range'),
    player_index: await extractor.getNumber('Player Index'),
  };
}
