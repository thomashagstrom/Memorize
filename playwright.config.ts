import { defineConfig } from '@playwright/test';

// Added with the end-to-end tests. Start the app, then run: npx playwright test
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000' },
});
