import { defineConfig, devices } from '@playwright/test';
import { ACK_STORAGE_KEY, ACK_VERSION } from './src/ui/ack';

// PW_PORT lets parallel worktrees run their own preview server (Phase 1 plan 06 deviation:
// a foreign server on 4173 was silently reused and tested another worktree's build).
const port = process.env['PW_PORT'] ?? '4173';
export const LOCAL_BASE = `http://localhost:${port}/procedure-trainer-da-50/`;
const liveBase = process.env['PW_BASE_URL'];
const baseURL = liveBase ?? LOCAL_BASE;

// Every project starts with the training-aid acknowledgment accepted, local and live; only
// e2e/ack.spec.ts overrides this with an empty state (PLT-04, RESEARCH Pitfall 2).
const ACCEPTED_STATE = {
  cookies: [],
  origins: [
    {
      origin: new URL(baseURL).origin,
      localStorage: [{ name: ACK_STORAGE_KEY, value: String(ACK_VERSION) }],
    },
  ],
};

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  // @hooks specs read the test-only window hook that only the e2e build contains.
  grepInvert: liveBase ? /@hooks/ : undefined,
  use: { baseURL, storageState: ACCEPTED_STATE, trace: 'on-first-retry' },
  ...(liveBase
    ? {}
    : {
        webServer: {
          // The npm preview:e2e script stays for manual use; here the port is variable and
          // --strictPort makes a clash fail loudly instead of testing a foreign build.
          command: `npm run build:e2e && BASE_PATH=/procedure-trainer-da-50/ npx vite preview --outDir dist-e2e --port ${port} --strictPort`,
          url: LOCAL_BASE,
          reuseExistingServer: !process.env['CI'] && !process.env['PW_PORT'],
          timeout: 180000,
        },
      }),
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'phone-chromium', use: { ...devices['Pixel 7 landscape'] } },
    { name: 'phone-webkit', use: { ...devices['iPhone 15 landscape'] } },
    { name: 'tablet-webkit', use: { ...devices['iPad (gen 11) landscape'] } },
    // The iPad landscape viewport (944 x 656) on Chromium, so the tablet case runs in the chromium
    // gate (R2-T1).
    {
      name: 'tablet-chromium',
      use: { ...devices['iPad (gen 11) landscape'], defaultBrowserType: 'chromium' },
    },
    { name: 'phone-portrait', use: { ...devices['iPhone 15'] } },
  ],
});
