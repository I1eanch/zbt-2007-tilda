import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __zbtMessages?: unknown[];
  }
}

const sections = [
  'hero', 'hook', 'audience', 'dual-value', 'program', 'career',
  'stats', 'speaker', 'bonuses', 'registration', 'footer',
];

test('embed route mirrors the landing sections without fixed chrome', async ({ page }) => {
  await page.goto('/embed/');

  const ids = await page.locator('main > section, main > footer').evaluateAll((nodes) =>
    nodes.map((node) => node.id),
  );
  expect(ids).toEqual(sections);

  // Fixed site-chrome is intentionally absent in the embed (it cannot stick in
  // an auto-height iframe); the registration modal stays.
  await expect(page.locator('[data-nav]')).toHaveCount(0);
  await expect(page.locator('[data-sticky-cta]')).toHaveCount(0);
  await expect(page.locator('[data-registration-modal]')).toHaveCount(1);

  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('embed sections match the landing composition (drift guard)', async ({ page }) => {
  await page.goto('/');
  const landing = await page.locator('main > section, main > footer').evaluateAll((nodes) =>
    nodes.map((node) => node.id),
  );
  await page.goto('/embed/');
  const embed = await page.locator('main > section, main > footer').evaluateAll((nodes) =>
    nodes.map((node) => node.id),
  );
  expect(embed).toEqual(landing);
});

test('embed renders content fully visible (no scroll-triggered reveals stuck hidden)', async ({ page }) => {
  await page.goto('/embed/');
  // In an auto-height iframe there is no internal scroll, so ScrollTrigger reveals
  // would never fire. The embed branch must clear them: every animated element
  // ends fully opaque instead of stuck at the reveal's initial opacity: 0.
  const opacities = await page.locator('[data-animate]').evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node).opacity),
  );
  expect(opacities.length).toBeGreaterThan(0);
  for (const opacity of opacities) {
    expect(opacity).toBe('1');
  }
});

test('embed bridge posts height and modal state to the parent', async ({ page }) => {
  // Keep the test hermetic: the third-party registration widget is not needed to
  // observe the modal-open relay (which fires on the data-open mutation).
  await page.route(/iandmyhealth\.ru/, (route) => route.abort());

  // Capture messages from before the page's own scripts run, so the bridge's
  // initial load-time height post is observed deterministically (a viewport
  // resize is not a reliable height change: this landing reflows to nearly the
  // same scrollHeight at desktop widths, so the deduped bridge would not repost).
  await page.addInitScript(() => {
    window.__zbtMessages = [];
    window.addEventListener('message', (event) => {
      window.__zbtMessages?.push(event.data);
    });
  });
  await page.goto('/embed/');

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.__zbtMessages ?? []).some((message) => {
          if (typeof message !== 'object' || message === null) return false;
          if (!('source' in message) || !('type' in message)) return false;
          if (message.source !== 'zbt-embed' || message.type !== 'zbt-embed:height') return false;
          return 'value' in message && typeof message.value === 'number' && message.value > 0;
        }),
      ),
    )
    .toBe(true);

  const modalMessageWithOpen = (open: boolean) =>
    page.evaluate(
      (expectedOpen) =>
        (window.__zbtMessages ?? []).some((message) => {
          if (typeof message !== 'object' || message === null) return false;
          if (!('source' in message) || !('type' in message)) return false;
          if (message.source !== 'zbt-embed' || message.type !== 'zbt-embed:modal') return false;
          return 'open' in message && message.open === expectedOpen;
        }),
      open,
    );

  const modal = page.locator('[data-registration-modal]');
  await page.locator('a[href="#registration"]').first().click();
  await expect(modal).toHaveAttribute('data-open', 'true');
  await expect.poll(() => modalMessageWithOpen(true)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(modal).toHaveAttribute('data-open', 'false');
  await expect.poll(() => modalMessageWithOpen(false)).toBe(true);
});

test('embed bridge re-posts a larger height when body content grows', async ({ page }) => {
  await page.goto('/embed/');

  // Capture the settled height the bridge reports at load time.
  const baseline = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        window.addEventListener('message', function handler(event) {
          const message = event.data;
          if (typeof message !== 'object' || message === null) return;
          if (!('type' in message) || message.type !== 'zbt-embed:height') return;
          if (!('value' in message) || typeof message.value !== 'number') return;
          window.removeEventListener('message', handler);
          resolve(message.value);
        });
        // Force a post in case the load-time message already fired.
        const spacer = document.createElement('div');
        spacer.style.height = '1px';
        spacer.setAttribute('data-embed-baseline-nudge', '');
        document.body.appendChild(spacer);
      }),
  );
  expect(baseline).toBeGreaterThan(0);

  // Grow the document by a known amount; the body ResizeObserver must fire and
  // report a height at least that much larger (proving the spacer caused it).
  await page.evaluate(() => {
    window.__zbtMessages = [];
    window.addEventListener('message', (event) => {
      window.__zbtMessages?.push(event.data);
    });
    const spacer = document.createElement('div');
    spacer.style.height = '1200px';
    spacer.setAttribute('data-embed-test-spacer', '');
    document.body.appendChild(spacer);
  });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const heights = (window.__zbtMessages ?? []).flatMap((message) => {
          if (typeof message !== 'object' || message === null) return [];
          if (!('type' in message) || message.type !== 'zbt-embed:height') return [];
          if (!('value' in message) || typeof message.value !== 'number') return [];
          return [message.value];
        });
        return heights.length ? Math.max(...heights) : 0;
      }),
    )
    .toBeGreaterThanOrEqual(baseline + 1000);
});

// End-to-end T123 topology: the real parent-page snippet (extracted verbatim
// from the runbook) framing /embed/. Exercises what the top-level embed tests
// cannot: the parent handler's auto-height, the modal fixed-fullscreen + body
// scroll lock, and restoration on close.
test('T123 parent snippet drives auto-height and modal fullscreen for the iframe', async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error('baseURL is required');

  await page.route(/iandmyhealth\.ru/, (route) => route.abort());

  // Use the exact snippet shipped in the runbook so its handler is what runs.
  const doc = readFileSync('docs/deployment/tilda-embed.md', 'utf8');
  const block = doc.match(/```html\n([\s\S]*?)```/);
  if (!block) throw new Error('T123 html snippet not found in tilda-embed.md');
  const snippet = block[1].replaceAll('SITE_URL', baseURL);

  await page.setContent(snippet, { waitUntil: 'load' });

  const frame = page.locator('#zbt-embed-frame');
  await expect(frame).toHaveCount(1);

  // Auto-height: the parent handler sets an explicit pixel height taller than a
  // single viewport once the bridge reports the document height.
  await expect
    .poll(async () => {
      const height = await frame.evaluate((el) => Number.parseFloat(el.style.height) || 0);
      return height;
    })
    .toBeGreaterThan(1000);

  const isFixed = () => frame.evaluate((el) => el.classList.contains('zbt-embed-fixed'));
  const bodyLocked = () =>
    page.evaluate(() => document.body.classList.contains('zbt-embed-modal-open'));
  const wrapperFrozen = () =>
    page.evaluate(() => {
      const wrap = document.getElementById('zbt-embed');
      return wrap ? (Number.parseFloat(wrap.style.height) || 0) : 0;
    });

  expect(await isFixed()).toBe(false);
  expect(await bodyLocked()).toBe(false);

  // Open the registration modal from inside the iframe.
  const embedFrame = page.frameLocator('#zbt-embed-frame');
  await embedFrame.locator('a[href="#registration"]').first().click();

  // Parent reacts: iframe goes fixed-fullscreen, parent scroll locks, and the
  // wrapper height is frozen so the page does not jump when the iframe leaves flow.
  await expect.poll(isFixed).toBe(true);
  await expect.poll(bodyLocked).toBe(true);
  expect(await wrapperFrozen()).toBeGreaterThan(1000);

  // Close from inside the iframe; parent restores flow.
  await embedFrame.locator('[data-registration-close]').click();
  await expect.poll(isFixed).toBe(false);
  await expect.poll(bodyLocked).toBe(false);
  expect(await wrapperFrozen()).toBe(0);
});
