import { expect, test } from '@playwright/test';

test('CTA exposes a visible focus state and valid registration anchor', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: /место|регистрац/i }).first();
  await expect(cta).toHaveAttribute('href', '#registration');
  await cta.focus();
  await expect(cta).toBeFocused();
  const outline = await cta.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
});

test('Bonus list items under #bonuses carry data-animate="reveal"', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#bonuses li[data-animate="reveal"]')).toHaveCount(4);
});
