import { defineConfig, devices } from '@playwright/test';

export const LOCAL_BASE = 'http://localhost:4173/procedure-trainer-da-50/';
const liveBase = process.env['PW_BASE_URL'];
const baseURL = liveBase ?? LOCAL_BASE;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  // @hooks specs read the test-only window hook that only the e2e build contains.
  grepInvert: liveBase ? /@hooks/ : undefined,
  use: { baseURL, trace: 'on-first-retry' },
  ...(liveBase
    ? {}
    : {
        webServer: {
          command: 'npm run build:e2e && npm run preview:e2e',
          url: LOCAL_BASE,
          reuseExistingServer: !process.env['CI'],
          timeout: 180000,
        },
      }),
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'phone-chromium', use: { ...devices['Pixel 7 landscape'] } },
    { name: 'phone-webkit', use: { ...devices['iPhone 15 landscape'] } },
    { name: 'tablet-webkit', use: { ...devices['iPad (gen 11) landscape'] } },
    { name: 'phone-portrait', use: { ...devices['iPhone 15'] } },
  ],
});
