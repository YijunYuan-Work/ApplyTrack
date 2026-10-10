import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/auth-ui',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5193',
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5193 --strictPort',
    url: 'http://127.0.0.1:5193',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54399',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-test-key',
      VITE_SUPABASE_ANON_KEY: 'synthetic-public-test-key',
    },
  },
})
