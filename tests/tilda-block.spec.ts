import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The Tilda T123 deliverable is a standalone self-contained HTML block
// (tilda-zbt.html) pasted into a Tilda page. These tests load it exactly as
// Tilda would — dropped into an arbitrary page next to unrelated markup — and
// guard the invariants that matter there: content parity with the current
// landing, no horizontal overflow, keyboard focus, and — critically — that the
// block's scoped styles do not leak onto sibling Tilda content.

const block = readFileSync('tilda-zbt.html', 'utf8');

// A sibling element OUTSIDE .zbt, representing Tilda's own chrome. Its default
// user-agent styles must survive (the scoped reset must not touch it).
const mockTildaPage = `<h2 id="tilda-sentinel">Заголовок Tilda</h2>${block}`;

test.beforeEach(async ({ page }) => {
  // Keep hermetic: block the external font + GetCourse widget requests.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.route(/iandmyhealth\.ru/, (route) => route.abort());
});

test('T123 block renders every section with current content', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });

  await expect(page.locator('.zbt-hero')).toHaveCount(1);
  await expect(page.locator('.zbt-hook')).toHaveCount(1);
  await expect(page.locator('.zbt-day')).toHaveCount(3);
  await expect(page.locator('.zbt-num')).toHaveCount(3);
  await expect(page.locator('.zbt-bonus-card')).toHaveCount(4);
  await expect(page.locator('#zbt-reg')).toHaveCount(1);

  // Current content: 18:00 МСК everywhere (Maket's 19:00 must not resurface).
  const text = await page.locator('.zbt').innerText();
  expect(text).toContain('18:00 МСК');
  expect(text).not.toContain('19:00');
  expect(text).toContain('ЗДОРОВЬЕ БЕЗ ТАБЛЕТОК');
  expect(text).toContain('Марина Жигульская');

  // Exactly one h1 in the block.
  await expect(page.locator('.zbt h1')).toHaveCount(1);
});

test('T123 block scoped styles do not leak onto sibling Tilda content', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });

  // The scoped reset zeroes margins for .zbt descendants only. A sibling <h2>
  // outside .zbt must keep its user-agent margin — proof the reset is contained.
  const sentinelMarginTop = await page
    .locator('#tilda-sentinel')
    .evaluate((el) => getComputedStyle(el).marginTop);
  expect(sentinelMarginTop).not.toBe('0px');

  // And a .zbt descendant heading MUST be reset to 0 (confirms the scope works).
  const heroTitleMargin = await page
    .locator('.zbt-hero h1')
    .evaluate((el) => getComputedStyle(el).marginTop);
  expect(heroTitleMargin).toBe('0px');
});

for (const width of [375, 1440]) {
  test(`T123 block has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(mockTildaPage, { waitUntil: 'load' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow detected').toBeLessThanOrEqual(1);
  });
}

test('T123 CTAs are keyboard-focusable with a visible outline', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const cta = page.locator('.zbt-hero .zbt-cta');
  await cta.focus();
  const outlineWidth = await cta.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(Number.parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2);
});

test('T123 block initialises its bridge exactly once (re-render guard)', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  await expect(page.locator('.zbt')).toHaveAttribute('data-zbt-init', '1');
});

test('T123 CTA scrolls to the registration form and loads the widget only once', async ({ page }) => {
  const widgetRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('id=1629532')) widgetRequests.push(request.url());
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(mockTildaPage, { waitUntil: 'load' });

  const before = await page.evaluate(() => window.scrollY);
  await page.locator('.zbt-hero .zbt-cta').click();

  // Smooth-scroll brings the registration section into view (poll until settled).
  await expect
    .poll(() =>
      page.locator('#zbt-reg').evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      }),
    )
    .toBe(true);
  const after = await page.evaluate(() => window.scrollY);
  expect(after, 'CTA should scroll the page down toward the form').toBeGreaterThan(before);

  // Re-trigger every CTA; the widget-load guard must keep it to a single request.
  await page.evaluate(() => {
    document.querySelectorAll('.zbt [data-zbt-reg]').forEach((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  });
  await page.waitForTimeout(400);

  await expect.poll(() => widgetRequests.length).toBeGreaterThan(0);
  expect(widgetRequests.length, 'widget script must load exactly once').toBe(1);
});

test('T123 day cards render three distinct bullet colors', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const colors = await page.evaluate(() =>
    ['1', '2', '3'].map((n) => {
      const li = document.querySelector(`.zbt-day--${n} .zbt-day-points li`);
      return li ? getComputedStyle(li, '::before').backgroundColor : '';
    }),
  );
  // Each day's bullet must be painted (regression guard for the nth-of-type bug)
  // and the three colors must be distinct.
  expect(colors.every((c) => c !== '' && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent')).toBe(true);
  expect(new Set(colors).size).toBe(3);
});

test('T123 floating CTA is inert (not focusable) while hidden', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const float = page.locator('[data-zbt-float]');
  await expect(float).toBeHidden();
  await expect(float).toHaveAttribute('aria-hidden', 'true');
  await expect(float.locator('a')).toHaveAttribute('tabindex', '-1');
});

test('T123 footer keeps the current legal/company details and links', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const footer = page.locator('.zbt-footer');
  await expect(footer).toContainText('ИП Жигульская Марина Федоровна');
  await expect(footer).toContainText('ИНН 246521495890');
  await expect(footer).toContainText('ОГРНИП 308246823300207');
  await expect(footer.locator('a[href="mailto:ondain21@gmail.com"]')).toHaveCount(1);
  for (const slug of ['consent', 'consent-to-mailing', 'regulament', 'public-offer']) {
    await expect(footer.locator(`a[href="https://mylifemyhealth.ru/${slug}"]`)).toHaveCount(1);
  }
});
