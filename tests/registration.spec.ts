import { expect, test } from '@playwright/test';

const LOCAL_ORIGIN = 'http://127.0.0.1:4321';

test('registration CTA opens the widget modal and posts nothing from our origin', async ({ page }) => {
  const localPosts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().startsWith(LOCAL_ORIGIN)) {
      localPosts.push(request.url());
    }
  });

  await page.goto('/');

  const modal = page.locator('[data-registration-modal]');
  await expect(modal).toHaveAttribute('data-open', 'false');

  // The section CTA opens the registration modal (name is unique — it must not
  // match the modal's "Закрыть окно регистрации" close button).
  await page.getByRole('button', { name: /забрать место и все подарки/i }).click();
  await expect(modal).toHaveAttribute('data-open', 'true');
  await expect(modal).toBeVisible();

  // Escape closes it again.
  await page.keyboard.press('Escape');
  await expect(modal).toHaveAttribute('data-open', 'false');

  // Our own origin issues no registration POST; the embedded third-party widget
  // owns submission to its own platform.
  expect(localPosts).toEqual([]);
});
