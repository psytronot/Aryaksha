import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'appdeploy-acceptance.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.APPDEPLOY_BASE_URL ?? 'https://orbital-lab-lq22ug.v2.appdeploy.ai/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
