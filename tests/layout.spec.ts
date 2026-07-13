import { expect, test } from '@playwright/test';

test('renders production metadata and one motion bootstrap', async ({ page }) => {
  const motionModuleLoads: string[] = [];
  page.on('request', (request) => {
    if (/\/lib\/motion(\.\w+)?(\?|$)/.test(request.url())) {
      motionModuleLoads.push(request.url());
    }
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/Здоровье без таблеток/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /нутрициолог/);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);

  // Layout is the single owner of motion. Astro externalises its framework-processed <script>,
  // so we assert the bundled bootstrap's observable effect — loading src/lib/motion exactly once —
  // rather than a marker attribute, which would force Astro `is:inline` and break bundling.
  await page.waitForLoadState('networkidle');
  expect(motionModuleLoads).toHaveLength(1);
});
