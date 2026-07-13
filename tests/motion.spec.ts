import { expect, test } from '@playwright/test';

test('keeps animated content visible when motion is reduced', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  // Apply the reduced-motion preference to the page directly; the file-level
  // test.use({ reducedMotion }) option did not propagate to matchMedia in this
  // toolchain, whereas emulateMedia before navigation reliably does.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('[data-animate]').first().waitFor();

  const hidden = await page.locator('[data-animate]').evaluateAll((elements) =>
    elements.filter((element) => getComputedStyle(element).opacity === '0').length,
  );
  expect(hidden, 'reduced-motion left animated content at opacity:0').toBe(0);

  expect(pageErrors, 'page emitted runtime errors').toEqual([]);
});
