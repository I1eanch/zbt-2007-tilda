import { expect, test } from '@playwright/test';

const LOCAL_ORIGIN = 'http://127.0.0.1:4321';

test.describe('accessibility and keyboard', () => {
  test('exposes one h1, anchored CTAs, and hidden decorative svgs', async ({ page }) => {
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

    await expect(page.locator('h1')).toHaveCount(1);


    // CTAs resolve to the registration anchor; no dead "#"/empty hrefs.
    await expect(page.locator('a[href="#registration"]:visible').first()).toBeVisible();
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    await expect(page.locator('a[href=""]')).toHaveCount(0);

    // Registration is CTA-only: no <form> and no inputs remain.
    await expect(page.locator('#registration form')).toHaveCount(0);
    await expect(page.locator('#registration input')).toHaveCount(0);

    // Decorative inline SVGs are hidden from the accessibility tree.
    await expect(page.locator('svg:not([aria-hidden="true"])')).toHaveCount(0);

    expect(pageErrors, 'page emitted runtime errors').toEqual([]);
    expect(failedLocalRequests, 'local asset requests failed').toEqual([]);
  });

  test('keyboard traversal reaches a registration CTA', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('h1').waitFor();

    // Tab until a #registration CTA anchor is focused (the header/hero CTAs sit
    // near the top of the tab order), then stop — no need to walk the whole page.
    let reachedRegistrationCta = false;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const href = await page.evaluate(() => document.activeElement?.getAttribute('href') ?? '');
      if (href === '#registration') {
        reachedRegistrationCta = true;
        break;
      }
    }
    expect(reachedRegistrationCta, 'Tab never reached a #registration CTA').toBe(true);

    // The registration section CTA is a real, keyboard-focusable <button>.
    const sectionCta = page.getByRole('button', { name: /забрать место и все подарки/i });
    await sectionCta.focus();
    await expect(sectionCta).toBeFocused();
  });

  test('sticky CTA retracts (cannot obstruct) when the registration CTA is focused', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    const cta = page.getByRole('button', { name: /регистрац/i });
    await cta.scrollIntoViewIfNeeded();
    await cta.focus();
    await expect(cta).toBeFocused();

    // The registration area (data-sticky-stop) is now in view, so the sticky
    // CTA retracts and cannot overlap the focused registration button.
    const stickyCta = page.locator('[data-sticky-cta]');
    await expect(stickyCta).toHaveAttribute('data-hidden', 'true');
    await expect(stickyCta).toHaveCSS('visibility', 'hidden');
    await expect(stickyCta).toHaveCSS('pointer-events', 'none');
  });
});
