import { Page } from '@playwright/test';
import {
  findMetricsBlock,
  waitForBlock,
  createValueExtractor,
} from './base.extractor.js';

export interface PlayerDetails {
  view_id: string;
  player_name: string | null;
  player_version: string | null;
  player_instance_id: string | null;
  software_name: string | null;
  software_version: string | null;
  player_height: number | null;
  player_width: number | null;
  player_language: string | null;
  mux_plugin: string | null;
  mux_plugin_version: string | null;
}

export async function extractPlayerDetails(
  page: Page,
  viewId: string,
  timeout = 15000
): Promise<PlayerDetails | null> {
  const block = findMetricsBlock(page, 'Player');

  if (!(await waitForBlock(block, timeout))) {
    console.warn(`Player block not found for ${viewId}`);
    return null;
  }

  const extractor = createValueExtractor(page, block);

  return {
    view_id: viewId,
    player_name: await extractor.getText('Player Name'),
    player_version: await extractor.getText('Player Version'),
    player_instance_id: await extractor.getText('Player Instance ID'),
    software_name: await extractor.getText('Software Name'),
    software_version: await extractor.getText('Software Version'),
    player_height: await extractor.getNumber('Player Height'),
    player_width: await extractor.getNumber('Player Width'),
    player_language: await extractor.getText('Player Language'),
    mux_plugin: await extractor.getText('Mux Plugin'),
    mux_plugin_version: await extractor.getText('Mux Plugin Version'),
  };
}
