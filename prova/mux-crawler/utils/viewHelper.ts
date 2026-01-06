import { Page } from '@playwright/test';

/**
 * Extract all view IDs from a paginated views list
 * Handles pagination automatically
 */
export async function extractAllViewIds(page: Page): Promise<string[]> {
  const viewIds = new Set<string>();
  let pageNumber = 1;
  const maxPages = 100; // Safety limit

  while (pageNumber <= maxPages) {
    // Wait for view links to appear
    try {
      await page.waitForSelector('a[href*="/views/"]', { timeout: 15000 });
    } catch {
      console.warn('No views found on page');
      break;
    }

    // Collect view IDs from current page
    const links = await page.locator('a[href*="/views/"]').all();

    for (const link of links) {
      const href = await link.getAttribute('href');
      if (!href) continue;

      const match = href.match(/\/views\/([a-f0-9-]+)/);
      if (match) {
        viewIds.add(match[1]);
      }
    }

    // Check for next page button
    const nextButton = page.getByRole('button', { name: /next/i });
    const isVisible = await nextButton.isVisible().catch(() => false);
    const isDisabled = await nextButton.isDisabled().catch(() => true);

    if (!isVisible || isDisabled) {
      break;
    }

    // Navigate to next page
    await nextButton.click();
    await page.waitForTimeout(2000); // Allow data to load
    pageNumber++;
  }

  console.log(`Extracted ${viewIds.size} view IDs from ${pageNumber} page(s)`);
  return [...viewIds];
}

/**
 * Wait for the view detail page to be fully loaded
 */
export async function waitForViewPageReady(page: Page, timeout = 30000): Promise<void> {
  // Wait for the main content container
  await page.waitForSelector('div._VideoViewDetails_93g9a_30 h4', { timeout });

  // Additional wait for dynamic content
  await page.waitForTimeout(1000);
}

/**
 * Build URL for views list with filters
 */
export function buildViewsListUrl(
  orgId: string,
  envId: string,
  options?: {
    userId?: string;
    startUnix?: number;
    endUnix?: number;
  }
): string {
  const baseUrl = `https://dashboard.mux.com/organizations/${orgId}/environments/${envId}/views`;

  const params: string[] = [];

  if (options?.userId) {
    params.push(`filters[0]=viewer_user_id:${encodeURIComponent(options.userId)}`);
  }

  if (options?.startUnix !== undefined && options?.endUnix !== undefined) {
    params.push(`timeframe[]=${options.startUnix}`);
    params.push(`timeframe[]=${options.endUnix}`);
  }

  return params.length > 0 ? `${baseUrl}?${params.join('&')}` : baseUrl;
}

/**
 * Build URL for a specific view detail page
 */
export function buildViewDetailUrl(orgId: string, envId: string, viewId: string): string {
  return `https://dashboard.mux.com/organizations/${orgId}/environments/${envId}/views/${viewId}`;
}
