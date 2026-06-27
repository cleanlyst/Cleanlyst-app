import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir    = path.resolve(__dirname, '..')

dotenv.config({ path: path.resolve(rootDir, '.env.playwright') })

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,

  reporter: [
    ['html', { outputFolder: path.join(__dirname, 'playwright-report'), open: 'never' }],
    ['json', { outputFile: path.join(__dirname, 'results/results.json') }],
    // Only print failures to stdout — passing tests are silent.
    ['github'],
    ['dot'],
  ],

  use: {
    baseURL:          process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://127.0.0.1:5173',
    headless:         true,
    viewport:         { width: 1280, height: 800 },
    actionTimeout:    20_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
    locale:           'en-GB',
    screenshot:       'only-on-failure',
    video:            'retain-on-failure',
    trace:            'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/stress/03-viewports.spec.ts',
    },
    {
      name: 'tablet-chrome',
      use: { ...devices['iPad (gen 11)'] },
      testMatch: '**/stress/03-viewports.spec.ts',
    },
    // Admin-acceptance suite runs on all three browser engines
    {
      name: 'firefox-admin',
      use: { ...devices['Desktop Firefox'] },
      testMatch: '**/admin-acceptance/**',
    },
    {
      name: 'webkit-admin',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/admin-acceptance/**',
    },
  ],

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    cwd: rootDir,
    url: process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://127.0.0.1:5173',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },

  globalSetup: path.resolve(rootDir, 'tests/e2e/global-setup.ts'),
})
