import { expect, test } from '@playwright/test';

test('renders three complete days and approved proof sections', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#program [data-program-day]')).toHaveCount(3);
  await expect(page.locator('#career [data-career-step]')).toHaveCount(5);
  await expect(page.locator('#stats [data-stat]')).toHaveCount(3);
  await expect(page.getByText('Марина Жигульская')).toBeVisible();
});
