import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  globalSetup: path.join(__dirname, 'auth', 'global-setup.ts'),

  // Test configuration
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  // Timeout configuration
  timeout: 120_000, // 2 minutes per test action
  expect: {
    timeout: 10_000, // 10 seconds for assertions
  },

  // Retry failed tests
  retries: 2,

  // Run tests sequentially (scraping should not be parallelized)
  workers: 1,
  fullyParallel: false,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Browser configuration
  use: {
    baseURL: 'https://dashboard.mux.com',
    storageState: path.join(__dirname, 'auth', 'auth.json'),

    // Headless by default, use --headed flag to see browser
    headless: true,

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Traces for debugging failed tests
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Navigation timeouts
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },

  // Projects for different extraction modes
  projects: [
    {
      name: 'extraction',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results',
});
