import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(`Warning: .env file not found at ${envPath}`);
  console.warn('Copy .env.example to .env and configure your credentials');
}

// Configuration
const AUTH_FILE = path.join(__dirname, 'auth.json');
const BASE_URL = 'https://dashboard.mux.com/login';
const MANUAL_VERIFICATION_WAIT = parseInt(process.env.MANUAL_VERIFICATION_WAIT || '300000', 10);

async function globalSetup(config: FullConfig) {
  console.log('\n========================================');
  console.log('  Mux Dashboard - Global Setup');
  console.log('========================================\n');

  // Check if auth session already exists and is valid
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));

      // Check if cookies exist and haven't expired
      const hasValidCookies = authData.cookies?.some((cookie: any) => {
        if (!cookie.expires || cookie.expires === -1) return true;
        return cookie.expires * 1000 > Date.now();
      });

      if (hasValidCookies) {
        console.log('Valid session found at:', AUTH_FILE);
        console.log('Skipping login - reusing existing session\n');
        return;
      } else {
        console.log('Session expired, re-authenticating...\n');
      }
    } catch {
      console.log('Invalid session file, re-authenticating...\n');
    }
  }

  console.log('No valid session found');
  console.log('Launching browser for manual authentication...\n');

  // Launch browser in visible mode for manual login
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100, // Slow down actions for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    // Navigate to login page
    console.log(`Navigating to: ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    console.log('Login page loaded\n');

    // Display instructions
    console.log('========================================');
    console.log('  MANUAL LOGIN REQUIRED');
    console.log('========================================');
    console.log('');
    console.log('Please complete the following steps:');
    console.log('');
    console.log('  1. Enter your email and password');
    console.log('  2. Click the Login button');
    console.log('  3. Complete MFA verification (if required)');
    console.log('  4. Wait for redirect to dashboard');
    console.log('');
    console.log(`Timeout: ${MANUAL_VERIFICATION_WAIT / 1000 / 60} minutes`);
    console.log('========================================\n');

    // Wait for successful authentication (redirect to views page)
    await page.waitForURL('**/views**', {
      timeout: MANUAL_VERIFICATION_WAIT,
    });

    console.log('Authentication successful!\n');

    // Save session state
    console.log('Saving session to:', AUTH_FILE);
    const storageState = await context.storageState();

    // Ensure auth directory exists
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));

    console.log('\n========================================');
    console.log('  Setup Complete!');
    console.log('========================================');
    console.log('');
    console.log('Session saved successfully.');
    console.log('Future test runs will reuse this session.');
    console.log('');

  } catch (error) {
    console.error('\n========================================');
    console.error('  Authentication Failed');
    console.error('========================================');
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('');
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
