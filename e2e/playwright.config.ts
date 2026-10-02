import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests of the whole platform running in Docker (`docker compose up -d`): our panel, a business's
 * admin panel and its shop, through the `web` container on E2E_PORT (default 8100).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
  outputDir: 'results',
  use: {
    headless: true,
    locale: 'uz-UZ',
    timezoneId: 'Asia/Tashkent',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
