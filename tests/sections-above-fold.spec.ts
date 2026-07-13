import { expect, test } from '@playwright/test';

test('renders approved first four sections in order', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('main > section').evaluateAll((sections) =>
    sections.map((section) => section.id),
  );
  expect(ids.slice(0, 4)).toEqual(['hero', 'hook', 'audience', 'dual-value']);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ЗДОРОВЬЕ БЕЗ ТАБЛЕТОК');
  await expect(page.getByText('Два результата за три дня')).toBeVisible();
});
