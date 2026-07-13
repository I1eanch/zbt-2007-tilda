import { expect, test } from '@playwright/test';

test('loads approved brand tokens and typography', async ({ page }) => {
  await page.goto('/');
  const tokens = await page.locator('html').evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      sky: styles.getPropertyValue('--color-sky').trim(),
      cta: styles.getPropertyValue('--color-cta').trim(),
      radius: styles.getPropertyValue('--radius-xl').trim(),
      heading: styles.getPropertyValue('--font-heading').trim(),
    };
  });
  expect(tokens).toEqual({
    sky: '#d4eaf7',
    cta: '#e0627a',
    radius: '20px',
    heading: "'Montserrat', sans-serif",
  });
});
