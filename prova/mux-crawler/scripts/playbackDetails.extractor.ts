import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface PlaybackDetails {
  view_id: string;
  remote_played: boolean | null;
  autoplay: boolean | null;
  preload: boolean | null;
  used_pip: boolean | null;
  used_captions: boolean | null;
  used_fullscreen: boolean | null;
  time_shift_enabled: boolean | null;
}

export async function extractPlaybackDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<PlaybackDetails | null> {
  const block = findMetricsBlock(page, 'Playback');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Playback block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    remote_played: await extractor.getBoolean('Remote Played'),
    autoplay: await extractor.getBoolean('Autoplay'),
    preload: await extractor.getBoolean('Preload'),
    used_pip: await extractor.getBoolean('Used PIP'),
    used_captions: await extractor.getBoolean('Used Captions'),
    used_fullscreen: await extractor.getBoolean('Used Fullscreen'),
    time_shift_enabled: await extractor.getBoolean('Time Shift Enabled'),
  };
}
