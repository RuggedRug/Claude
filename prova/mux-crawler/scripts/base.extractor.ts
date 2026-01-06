import { Page, Locator } from '@playwright/test';

/**
 * Base class for metric extractors
 * Provides common utilities for scraping the Mux dashboard
 */

const BLOCK_SELECTOR = 'div._VideoViewDetails_93g9a_30';

/**
 * Find a metrics block by its header text
 */
export function findMetricsBlock(page: Page, headerText: string): Locator {
  return page.locator(BLOCK_SELECTOR).filter({
    has: page.locator('h4', { hasText: new RegExp(headerText, 'i') }),
  });
}

/**
 * Wait for a metrics block to be visible
 */
export async function waitForBlock(
  block: Locator,
  timeout = 15000
): Promise<boolean> {
  try {
    await block.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a value extractor for a metrics block
 */
export function createValueExtractor(page: Page, block: Locator) {
  return {
    /**
     * Get raw text value from a table row
     */
    async getText(label: string): Promise<string | null> {
      const row = block.locator('tr', {
        has: page.locator('th', { hasText: new RegExp(`^${label}$`, 'i') }),
      });

      if ((await row.count()) === 0) return null;

      const cell = row.locator('td div').first();
      try {
        await cell.waitFor({ state: 'attached', timeout: 3000 });
        const text = await cell.textContent();
        return text?.trim() ?? null;
      } catch {
        return null;
      }
    },

    /**
     * Get numeric value (parses and cleans numeric strings)
     */
    async getNumber(label: string): Promise<number | null> {
      const raw = await this.getText(label);
      return parseNumber(raw);
    },

    /**
     * Get boolean value
     */
    async getBoolean(label: string): Promise<boolean | null> {
      const raw = await this.getText(label);
      return parseBoolean(raw);
    },
  };
}

/**
 * Parse a string to number, handling units like %, Mbps, s, etc.
 */
export function parseNumber(raw: string | null): number | null {
  if (!raw) return null;

  const cleaned = raw
    .replace(/%/g, '')
    .replace(/Mbps/gi, '')
    .replace(/seconds?/gi, '')
    .replace(/seeks?/gi, '')
    .replace(/rebuffer\/min/gi, '')
    .replace(/[a-zA-Z]/g, '')
    .replace(/,/g, '')
    .trim();

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse a string to boolean
 */
export function parseBoolean(raw: string | null): boolean | null {
  if (raw === null) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === 'true' || lower === 'yes') return true;
  if (lower === 'false' || lower === 'no') return false;
  return null;
}

/**
 * Parse duration strings like "1m 30s" or "45s"
 */
export function parseDuration(raw: string | null): number | null {
  if (!raw) return null;

  let seconds = 0;
  const minutes = /(\d+)m/.exec(raw)?.[1];
  const secs = /(\d+(?:\.\d+)?)s/.exec(raw)?.[1];

  if (minutes) seconds += Number(minutes) * 60;
  if (secs) seconds += Number(secs);

  return seconds > 0 ? seconds : null;
}

/**
 * Parse seeking strings like "1 seek for 1.3s"
 */
export function parseSeeking(raw: string | null): {
  count: number | null;
  duration: number | null;
} {
  if (!raw) return { count: null, duration: null };

  const countMatch = /(\d+)\s+seek/.exec(raw)?.[1];
  const durationMatch = /([\d.]+)s/.exec(raw)?.[1];

  return {
    count: countMatch ? Number(countMatch) : null,
    duration: durationMatch ? Number(durationMatch) : null,
  };
}
