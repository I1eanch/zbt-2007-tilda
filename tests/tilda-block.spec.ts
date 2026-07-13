import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The Tilda T123 deliverable is a standalone self-contained HTML block
// (tilda-zbt.html) pasted into a Tilda page. Photos are hosted in this GitHub
// repo (tilda-assets/) and referenced via the jsDelivr CDN. For hermetic tests
// we swap those CDN URLs for inline data URIs (from the local optimized files)
// so images render without network and layout can be measured.

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/I1eanch/zbt-2007-tilda@main/tilda-assets/';
const assetFiles = [
  'hero-background.jpg', 'hero-portrait.jpg',
  'program-day-1.jpg', 'program-day-2.jpg', 'program-day-3.jpg',
  'bonus-test.jpg', 'bonus-roadmap.jpg', 'bonus-niches.jpg', 'bonus-video.jpg',
  'speaker-marina.jpg',
];

const rawBlock = readFileSync('tilda-zbt.html', 'utf8');

let resolved = rawBlock;
for (const file of assetFiles) {
  const dataUri = `data:image/jpeg;base64,${readFileSync(`tilda-assets/${file}`).toString('base64')}`;
  resolved = resolved.split(CDN_BASE + file).join(dataUri);
}

// A sibling element OUTSIDE .zbt (Tilda's own content). Its user-agent styles
// must survive the scoped reset.
const mockTildaPage = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h2 id="tilda-sentinel">Заголовок Tilda</h2>${resolved}</body></html>`;

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.route(/iandmyhealth\.ru/, (route) => route.abort());
  await page.route(/cdn\.jsdelivr\.net/, (route) => route.abort());
});

test('block references every photo from the GitHub CDN, no leftover tokens', () => {
  expect(rawBlock).not.toContain('@@');
  for (const file of assetFiles) {
    expect(rawBlock).toContain(CDN_BASE + file);
  }
});

test('block renders header, hero photo and every section with current content', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });

  // Desktop nav has the four section links; the CTA appears once in the desktop
  // nav (the same links are duplicated in the mobile panel).
  await expect(page.locator('.zbt-nav-links [data-zbt-nav]')).toHaveCount(4);
  await expect(page.locator('.zbt-nav-cta [data-zbt-reg]')).toHaveCount(1);

  // Real photographic hero (background + Marina portrait), not inline SVG art.
  await expect(page.locator('.zbt-hero-bg')).toHaveCount(1);
  await expect(page.locator('.zbt-hero-photo img')).toHaveCount(1);

  // Sections in order.
  const ids = await page.locator('.zbt > section').evaluateAll((nodes) => nodes.map((n) => n.id));
  expect(ids).toEqual([
    'hero', 'hook', 'audience', 'dual-value', 'program',
    'career', 'stats', 'speaker', 'bonuses', 'registration',
  ]);

  // Real content assets: 3 day photos, 4 bonus photos, speaker photo.
  await expect(page.locator('#program .zbt-day')).toHaveCount(3);
  await expect(page.locator('#program .zbt-day-photo img')).toHaveCount(3);
  await expect(page.locator('#bonuses .zbt-bonus-card')).toHaveCount(4);
  await expect(page.locator('#bonuses .zbt-bonus-photo img')).toHaveCount(4);
  await expect(page.locator('.zbt-speaker-photo')).toHaveCount(1);

  // Current content: 18:00 МСК (Maket's 19:00 must not resurface); one h1.
  const text = await page.locator('.zbt').innerText();
  expect(text).toContain('18:00 МСК');
  expect(text).not.toContain('19:00');
  expect(text).toContain('Марина Жигульская');
  await expect(page.locator('.zbt h1')).toHaveCount(1);
});

test('scoped styles do not leak onto sibling Tilda content', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const sentinelMarginTop = await page
    .locator('#tilda-sentinel')
    .evaluate((el) => getComputedStyle(el).marginTop);
  expect(sentinelMarginTop).not.toBe('0px');
  const heroTitleMargin = await page
    .locator('.zbt-hero h1')
    .evaluate((el) => getComputedStyle(el).marginTop);
  expect(heroTitleMargin).toBe('0px');
});

for (const width of [375, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(mockTildaPage, { waitUntil: 'load' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow detected').toBeLessThanOrEqual(1);
  });
}

test('speaker photo matches the text-column height on desktop, keeps 4:5 on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const desktop = await page.evaluate(() => {
    const photo = document.querySelector('.zbt-speaker-photo');
    const textCol = document.querySelector('.zbt-speaker > div:last-child');
    if (!photo || !textCol) return null;
    return { photoH: photo.getBoundingClientRect().height, textH: textCol.getBoundingClientRect().height };
  });
  expect(desktop).not.toBeNull();
  expect(Math.abs((desktop?.photoH ?? 0) - (desktop?.textH ?? 0))).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 390, height: 900 });
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const ratio = await page.evaluate(() => {
    const r = document.querySelector('.zbt-speaker-photo');
    if (!r) return 0;
    const box = r.getBoundingClientRect();
    return box.height / box.width;
  });
  expect(ratio).toBeGreaterThan(1.15);
  expect(ratio).toBeLessThan(1.35);
});

test('CTAs are keyboard-focusable with a visible outline', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const cta = page.locator('.zbt-hero .zbt-btn');
  await cta.focus();
  const outlineWidth = await cta.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(Number.parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2);
});

test('floating CTA is inert (not focusable) while hidden', async ({ page }) => {
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const float = page.locator('[data-zbt-float]');
  await expect(float).toBeHidden();
  await expect(float).toHaveAttribute('aria-hidden', 'true');
  await expect(float.locator('a')).toHaveAttribute('tabindex', '-1');
});

test('CTA scrolls to the registration form and loads the widget only once', async ({ page }) => {
  const widgetRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('id=1629532')) widgetRequests.push(request.url());
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(mockTildaPage, { waitUntil: 'load' });

  const before = await page.evaluate(() => window.scrollY);
  await page.locator('.zbt-hero .zbt-btn').click();

  await expect
    .poll(() =>
      page.locator('#registration').evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      }),
    )
    .toBe(true);
  const after = await page.evaluate(() => window.scrollY);
  expect(after, 'CTA should scroll the page toward the form').toBeGreaterThan(before);

  await page.evaluate(() => {
    document.querySelectorAll('.zbt [data-zbt-reg]').forEach((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  });
  await page.waitForTimeout(400);

  await expect.poll(() => widgetRequests.length).toBeGreaterThan(0);
  expect(widgetRequests.length, 'widget script must load exactly once').toBe(1);
});

test('mobile burger toggles the nav panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(mockTildaPage, { waitUntil: 'load' });
  const burger = page.locator('[data-zbt-burger]');
  const panel = page.locator('[data-zbt-panel]');
  // At mobile widths the burger is shown (it is display:none only ≥860px).
  expect(await burger.evaluate((el) => getComputedStyle(el).display)).not.toBe('none');
  await expect(panel).toHaveAttribute('data-open', 'false');
  // Dispatch the click directly so the assertion targets the toggle handler,
  // independent of Playwright's mobile-emulation visibility heuristics.
  await burger.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect(panel).toHaveAttribute('data-open', 'true');
  await expect(burger).toHaveAttribute('aria-expanded', 'true');
});
