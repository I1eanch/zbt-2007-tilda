import { expect, test } from '@playwright/test';

const LOCAL_ORIGIN = 'http://127.0.0.1:4321';

test('keeps content inside the viewport and reveals registration', async ({ page }) => {
  const pageErrors: string[] = [];
  const failedLocalRequests: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText ?? 'failed';
    // Browsers abort unused <img srcset> candidates (net::ERR_ABORTED) — an
    // expected optimization, not a broken asset.
    if (url.startsWith(LOCAL_ORIGIN) && errorText !== 'net::ERR_ABORTED') {
      failedLocalRequests.push(`${url} :: ${errorText}`);
    }
  });

  await page.goto('/', { waitUntil: 'load' });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal scrollbar / overflow detected').toBeLessThanOrEqual(1);

  await expect(page.locator('#registration')).toBeVisible();

  expect(pageErrors, 'page emitted runtime errors').toEqual([]);
  expect(failedLocalRequests, 'local asset requests failed').toEqual([]);
});
