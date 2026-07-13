import { expect, test } from '@playwright/test';

const FINALS = ['3 500+', '7 лет', '+276%'];

test('stat counters animate up to their final formatted values', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/', { waitUntil: 'load' });

  const counters = page.locator('#stats [data-count-up]');
  await expect(counters).toHaveCount(3);

  // Scroll each stat into view to fire its scroll-triggered count-up; toHaveText
  // retries until the count-up settles on the final value, preserving
  // prefixes/suffixes and the thousands separator. On mobile the cards stack, so
  // the lower ones only enter the viewport after an explicit scroll.
  for (let i = 0; i < FINALS.length; i++) {
    await counters.nth(i).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(counters.nth(i)).toHaveText(FINALS[i]);
  }

  expect(pageErrors, 'page emitted runtime errors').toEqual([]);
});

test('stat counters render final values immediately under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'load' });

  const counters = page.locator('#stats [data-count-up]');
  await counters.first().scrollIntoViewIfNeeded();

  // No count-up runs: SSR final values stay untouched.
  for (let i = 0; i < FINALS.length; i++) {
    await expect(counters.nth(i)).toHaveText(FINALS[i]);
  }
});

test('stat counter steps through intermediate values (real count-up, not an instant swap)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });

  const seen = await page.evaluate(async () => {
    const el = document.querySelector('#stats [data-count-up]');
    if (!el) return null;
    const history: string[] = [el.textContent ?? ''];
    const observer = new MutationObserver(() => history.push(el.textContent ?? ''));
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    el.scrollIntoView({ block: 'center' });
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 2500);
    await promise;
    observer.disconnect();
    return history;
  });

  expect(seen, 'no #stats counter found').not.toBeNull();
  if (!seen) return;

  const numeric = (value: string) => Number.parseInt(value.replace(/\D/g, '') || '0', 10);

  // Many distinct frames → the value stepped through, not an instant SSR passthrough.
  expect(new Set(seen).size, `counter did not step: ${JSON.stringify(seen)}`).toBeGreaterThan(2);
  // Count-up passes through a near-zero frame (it starts low, not at the final).
  expect(seen.some((value) => numeric(value) < 500)).toBe(true);
  // And settles exactly on the fully formatted final value.
  expect(seen[seen.length - 1]).toBe('3 500+');
});
