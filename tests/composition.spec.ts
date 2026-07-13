import { expect, test } from '@playwright/test';

const expected = [
  'hero', 'hook', 'audience', 'dual-value', 'program', 'career',
  'stats', 'speaker', 'bonuses', 'registration', 'footer',
];

test('renders every approved module in exact order', async ({ page }) => {
  await page.goto('/');
  const actual = await page.locator('main > section, main > footer').evaluateAll((nodes) =>
    nodes.map((node) => node.id),
  );
  expect(actual).toEqual(expected);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
});
