import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: false,
    // Astro 7 под агент-харнессом (am-i-vibing) авто-демонизирует `astro dev`.
    // Переменная ASTRO_DEV_BACKGROUND удерживает процесс в foreground, чтобы
    // управляемый Playwright webServer-процесс не завершался сразу.
    env: { ASTRO_DEV_BACKGROUND: '1' },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
});
