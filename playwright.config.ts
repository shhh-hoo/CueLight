import { defineConfig, devices } from '@playwright/test';

const devPort = Number(process.env.CUELIGHT_TEST_DEV_PORT ?? 5173);
const devUrl = `http://127.0.0.1:${devPort}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'development', testMatch: /(?:replay|jev|presentation|alive)\.spec\.ts/, use: { baseURL: devUrl } },
    { name: 'microphone', testMatch: 'microphone.spec.ts', use: { baseURL: devUrl,
      launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } } },
    { name: 'production', testMatch: 'production.spec.ts', use: { baseURL: 'http://127.0.0.1:4173' } },
  ],
  webServer: [
    { command: `npm run dev -- --port ${devPort} --strictPort`, url: devUrl, reuseExistingServer: false },
    { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  ],
});
