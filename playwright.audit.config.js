import { defineConfig } from '@playwright/test'
import process from 'node:process'

export default defineConfig({
  testDir: './tests/refinement-02/ui',
  // CI runs Chromium files concurrently; local multi-browser runs stay serial.
  workers: process.env.CI ? 2 : 1,
  outputDir: './test-results/functional',
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report/functional', open: 'never' }],
  ],
  use: { baseURL: 'http://127.0.0.1:5195', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  projects: ['chromium', 'firefox', 'webkit'].map((browserName) => ({ name: browserName, use: { browserName } })),
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5195 --strictPort',
    url: 'http://127.0.0.1:5195', reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54399', VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-test-key', VITE_SUPABASE_ANON_KEY: 'synthetic-public-test-key', VITE_JOB_ALERT_INBOUND_DOMAIN: 'inbound.example.invalid' },
  },
})
