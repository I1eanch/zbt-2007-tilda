# Astro Landing and Dokploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести утверждённый лендинг школы «Ресурс» из `Maket.html` в Astro, сохранить дизайн-систему, проверить UX/доступность и развернуть static image через Dokploy на собственном VPS.

**Architecture:** `src/pages/index.astro` только компонует section modules. `Layout.astro` владеет document metadata и единым GSAP bootstrap; повторяющийся контент типизирован в `src/content/landing.ts`; design values поступают из существующих `design-tokens.json`/`tokens.css`. Production build копируется в nginx image и маршрутизируется Dokploy/Traefik через container port 80.

**Tech Stack:** Node 22.22.2, npm 10.9.7, Astro 6.2.2, Tailwind CSS 4.2.4, `@tailwindcss/vite` 4.2.4, GSAP 3.15.0, `@astrojs/check`, TypeScript, Playwright, Docker, nginx, Dokploy.

**Approved specification:** `docs/superpowers/specs/2026-07-10-astro-landing-dokploy-design.md`

**VCS constraint:** План не содержит `git commit`/`git push`; пользователь управляет commits отдельно.

---

## Implementation Map

| Task | Working result | Depends on |
|---|---|---|
| 1 | QA toolchain запускается на текущем scaffold | — |
| 2 | Design tokens реально подключены и проверены | 1 |
| 3 | Repeated marketing content типизирован и валидируется | 1 |
| 4 | Layout, metadata и centralized motion готовы | 2 |
| 5 | Shared UI primitives готовы | 2 |
| 6 | Hero-to-DualValue vertical slice работает | 3–5 |
| 7 | Program-to-Speaker vertical slice работает | 3–5 |
| 8 | Bonuses-to-StickyCTA vertical slice работает | 3–5 |
| 9 | Composition, assets и SEO завершены | 6–8 |
| 10 | Browser QA защищает behavior/accessibility/layout | 9 |
| 11 | Docker/nginx artifact проходит local smoke | 10 |
| 12 | Dokploy runbook готов и проверяем | 11 |
| 13 | Integrated release gate и repository guidance завершены | 12 |

## Exact Section Contract

```text
hero → hook → audience → dual-value → program → career → stats → speaker → bonuses → registration → footer
```

`StickyCTA.astro` рендерится после footer, но остаётся fixed overlay. Все CTA используют `href="#registration"`.

---

### Task 1: Add the verification toolchain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `tests/scaffold.spec.ts`

- [ ] **Step 1: Install development-only verification dependencies**

Run:

```bash
npm install --save-dev @astrojs/check typescript @playwright/test
npx playwright install chromium
```

Expected: npm exits `0`; `package-lock.json` records the three dev dependencies; Chromium installation exits `0`.

- [ ] **Step 2: Add verification scripts**

Change the `scripts` object in `package.json` to:

```json
{
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check",
  "validate:content": "node --experimental-strip-types scripts/validate-content.mjs",
  "test:e2e": "playwright test",
  "verify": "npm run validate:content && npm run check && npm run build && npm run test:e2e"
}
```

Do not add lint/test frameworks beyond the approved dependencies.

- [ ] **Step 3: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
});
```

- [ ] **Step 4: Write and run the scaffold baseline test**

Create `tests/scaffold.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('serves a Russian HTML document without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(response?.status()).toBe(200);
  expect(errors).toEqual([]);
});
```

Run:

```bash
npm run check
npm run test:e2e -- --project=desktop-chromium tests/scaffold.spec.ts
```

Expected: both commands pass before migration begins.

---

### Task 2: Wire the existing design system into Astro

**Files:**
- Modify: `src/styles/global.css`
- Modify: `tokens.css:148-166`
- Modify: `Design.md:67-71`
- Create: `tests/design-system.spec.ts`

- [ ] **Step 1: Write the failing computed-style contract**

Create `tests/design-system.spec.ts`:

```ts
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
```

Run:

```bash
npm run test:e2e -- --project=desktop-chromium tests/design-system.spec.ts
```

Expected: FAIL because root `tokens.css` is not imported by the current scaffold.

- [ ] **Step 2: Import tokens and expose semantic Tailwind aliases**

Replace `src/styles/global.css` with:

```css
@import "tailwindcss";
@import "../../tokens.css";

@theme inline {
  --color-brand-sky: var(--color-sky);
  --color-brand-sky-light: var(--color-sky-light);
  --color-brand-blush: var(--color-blush);
  --color-brand-blush-light: var(--color-blush-light);
  --color-brand-rose: var(--color-rose);
  --color-brand-rose-deep: var(--color-rose-deep);
  --color-brand-cta: var(--color-cta);
  --color-brand-text: var(--color-text);
  --color-brand-muted: var(--color-text-muted);
  --font-brand-heading: var(--font-heading);
  --font-brand-body: var(--font-body);
}

html {
  scroll-behavior: smooth;
  scroll-padding-top: var(--space-4);
}

body {
  margin: 0;
  min-width: 320px;
  background: var(--color-snow);
  color: var(--color-text);
  font-family: var(--font-body);
  line-height: var(--lh-relaxed);
  -webkit-font-smoothing: antialiased;
}

:focus-visible {
  outline: 3px solid var(--color-blue-deep);
  outline-offset: 3px;
}
```

- [ ] **Step 3: Remove broad transitions from the runtime tokens**

In `tokens.css`, replace:

```css
transition: all var(--duration-base) var(--ease-default);
```

with:

```css
transition:
  transform var(--duration-base) var(--ease-default),
  box-shadow var(--duration-base) var(--ease-default),
  background-color var(--duration-base) var(--ease-default),
  color var(--duration-base) var(--ease-default),
  border-color var(--duration-base) var(--ease-default),
  opacity var(--duration-base) var(--ease-default);
```

- [ ] **Step 4: Update the design-system usage note**

Update `Design.md` so runtime usage explicitly imports `tokens.css` through `src/styles/global.css`, and states:

```text
Raw colors, spacing, radii, shadows and durations are not copied into Astro modules.
Inline SVG artwork may preserve approved Maket.html colors.
```

- [ ] **Step 5: Re-run the contract**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium tests/design-system.spec.ts
```

Expected: PASS with the four exact computed values.

---

### Task 3: Model and validate repeated landing content

**Files:**
- Create: `src/content/landing.ts`
- Create: `scripts/validate-content.mjs`
- Reference unchanged: `Maket.html:236-247,300-455,471-543`

- [ ] **Step 1: Write the failing content validator**

Create `scripts/validate-content.mjs`:

```js
import {
  audienceItems,
  bonuses,
  careerSteps,
  programDays,
  registrationGifts,
  stats,
} from '../src/content/landing.ts';

const expectedCounts = new Map([
  ['audienceItems', [audienceItems, 6]],
  ['programDays', [programDays, 3]],
  ['careerSteps', [careerSteps, 5]],
  ['stats', [stats, 3]],
  ['bonuses', [bonuses, 4]],
  ['registrationGifts', [registrationGifts, 7]],
]);

for (const [name, [items, expected]] of expectedCounts) {
  if (items.length !== expected) {
    throw new Error(`${name}: expected ${expected}, received ${items.length}`);
  }
}

for (const day of programDays) {
  if (day.points.length < 5 || !day.giftTitle || !day.giftDescription) {
    throw new Error(`program day ${day.day} is incomplete`);
  }
}

console.log('content validation passed');
```

Run:

```bash
npm run validate:content
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/content/landing.ts`.

- [ ] **Step 2: Create exact content types and exports**

Create `src/content/landing.ts` with these interfaces and exported readonly arrays:

```ts
export interface ProgramDay {
  day: 1 | 2 | 3;
  date: string;
  title: string;
  hook: string;
  points: readonly string[];
  giftTitle: string;
  giftDescription: string;
  tone: 'blush' | 'sky' | 'mixed';
}

export interface Bonus {
  title: string;
  description: string;
  tag: string;
  icon: 'test' | 'roadmap' | 'niches' | 'video';
}

export interface Stat {
  value: string;
  label: string;
}

export interface CareerStep {
  title: string;
  description: string;
}

export interface RegistrationGift {
  timing: 'сразу' | 'день 1' | 'день 2' | 'день 3';
  text: string;
}

export const audienceItems = [
  'Здоровье для вас — реальная ценность, не тост на празднике. Хотите разобраться по-настоящему',
  'Перепробовали диеты, витамины, врачей — ничего не помогло. «Анализы в норме», а вам плохо',
  'Хотите транслировать здоровье, молодость, красоту — и мотивировать других быть здоровыми',
  'Живёте в нестабильное время — хотите зарабатывать удалённо, из любой точки мира',
  'Хотите зарабатывать на том, что близко — помогать людям и получать благодарности',
  'Вы тренер, врач или специалист — хотите добавить нутрициологию и кратно увеличить доход',
] as const;

export const programDays: readonly ProgramDay[] = [
  {
    day: 1,
    date: '20 июля, 19:00 МСК',
    title: 'Почему мы болеем: организм — единое целое, а не набор отдельных органов',
    hook: 'Медицина блестяще объясняет, КАК устроена болезнь — вплоть до молекул. Но почти никогда не отвечает на главный вопрос: ПОЧЕМУ она возникла именно у вас. За вечер вы увидите, где искать ответ — и это меняет взгляд на здоровье навсегда.',
    points: [
      'Почему у нас нет «инструкции» к собственному телу — и с чего начать её собирать',
      'Медицина отвечает, «как» болезнь устроена, а нутрициология и натуропатия — «почему» она возникла. Именно с «почему» начинается восстановление',
      'Главное открытие вечера: ни один орган не работает сам по себе. Варикоз — не про вены, мигрень — не про голову, щитовидка — не про шею. Это всегда про весь организм',
      'Живой пример на эфире: как по симптомам увидеть, где на самом деле сбой',
      'Почему это знание нужно каждому — маме, тренеру, врачу, предпринимателю — как инструкция к здоровой жизни, даже если вы не собираетесь быть нутрициологом',
    ],
    giftTitle: 'Подарок: «Карта симптомов: 30 сигналов тела»',
    giftDescription: 'PDF-гайд — какие жалобы связаны с какими дефицитами. Инструмент, которым пользуются нутрициологи',
    tone: 'blush',
  },
  {
    day: 2,
    date: '21 июля, 19:00 МСК',
    title: 'Еда как лекарство: как собирается питание, которым правда можно восстанавливаться',
    hook: 'Дело не в списке «полезных продуктов». Даже у самого природного продукта есть свойства, которые наполняют, и те, что забирают энергию. Вы увидите, как нутрициолог собирает питание под конкретного человека — а не выдаёт одно меню на всех.',
    points: [
      'Что такое питание, которым можно восстанавливаться: продукты, которые дают энергию, и продукты, которые её забирают',
      '5 шагов работы нутрициолога: как из жалоб, образа жизни и анализов собрать единую картину и подобрать то, что подходит именно этому телу',
      'Почему километровые схемы добавок не работают: когда БАД превращают в лекарство, специалист просто лечит симптом — как и не думающий врач',
      'Почему рынку нужен не «ещё один нутрициолог», а тот, кто умеет мыслить системно и видеть картину целиком',
      'Первая ступень профессии — консультант по питанию: не «выдать меню», а научить человека собирать тарелку и слышать реакции своего тела',
      'Где брать первых клиентов и как провести первую консультацию',
    ],
    giftTitle: 'Подарок: «Антивоспалительная тарелка + меню на 3 дня» + «Как найти первых 5 клиентов»',
    giftDescription: 'Конкретный рацион для себя + пошаговый план выхода на первые консультации',
    tone: 'sky',
  },
  {
    day: 3,
    date: '22 июля, 19:00 МСК',
    title: 'Тренды, антивозраст и профессия, которая начинается с вас самих',
    hook: 'Индустрия БАДов растёт бешено — а люди как болели, так и болеют. Потому что специалистов, которые мыслят системно, а не «симптом → добавка», единицы. Вы увидите, как стать именно таким — и почему нутрициолог всегда сам себе лучшая витрина.',
    points: [
      'Что реально работает в антивозрасте: пептиды и современные подходы — простым языком, без хайпа',
      'Почему «болячка → добавка» — тупик, и что делает системный специалист вместо этого',
      'Продукт своего продукта: нутрициолог сначала восстанавливает себя — выглядит моложе, живёт энергичнее — и это лучшая реклама профессии',
      'Путь развития: от заботы о себе → к обучению людей → к коллаборациям и собственным марафонам',
      'Как хороший нутрициолог работает в связке с врачами, косметологами, тренерами — и усиливает результат каждого',
      'Как на этом зарабатывать — честно, по шагам, из любой точки мира',
    ],
    giftTitle: 'Подарок: «Что реально работает в антивозрасте: пептиды и не только»',
    giftDescription: 'Разбор современных подходов простым языком + как отличить рабочее от хайпа',
    tone: 'mixed',
  },
];

export const careerSteps: readonly CareerStep[] = [
  { title: 'Разбираетесь в себе и семье.', description: 'Почему усталость, вес, сон и гормоны ведут себя именно так — и что с этим делать' },
  { title: 'Учитесь видеть связи.', description: 'Не «железо низкое», а почему оно снижается. Не «вздутие», а что за ним стоит' },
  { title: 'Пробуете консультировать.', description: 'Как задавать вопросы, объяснять просто и давать понятные первые шаги' },
  { title: 'Берёте первых клиентов.', description: 'Сначала простые запросы, потом сопровождение — сначала знакомые, потом по рекомендациям' },
  { title: 'Выходите на устойчивость.', description: 'Доход появляется, когда есть навык и доверие — а не наоборот' },
];

export const stats: readonly Stat[] = [
  { value: '3 500+', label: 'прошли программы Марины' },
  { value: '7 лет', label: 'практики и протоколов' },
  { value: '+276%', label: 'рост профессии за 20 лет' },
];

export const bonuses: readonly Bonus[] = [
  { title: 'Тест: насколько вы метаболически здоровы?', description: '10 вопросов — узнаете зону риска и с чего начинать.', tag: 'Мгновенный результат', icon: 'test' },
  { title: 'Дорожная карта: нутрициолог с нуля за 90 дней', description: 'Что изучить, где первые клиенты, как не бояться начать.', tag: 'PDF-чек-лист', icon: 'roadmap' },
  { title: '10 ниш в нутрициологии, где сейчас пусто', description: 'Спортивная, anti-age, ЖКТ, женское здоровье — где дефицит.', tag: 'PDF-гайд', icon: 'niches' },
  { title: 'Видео Марины: 5 ошибок в восстановлении здоровья', description: '15 минут — почему всё, что пробовали, не работало.', tag: 'Видео-урок', icon: 'video' },
];

export const registrationGifts: readonly RegistrationGift[] = [
  { timing: 'сразу', text: 'Тест на метаболическое здоровье' },
  { timing: 'сразу', text: 'Дорожная карта нутрициолога' },
  { timing: 'сразу', text: 'Гайд: 10 ниш в нутрициологии' },
  { timing: 'сразу', text: 'Видео: 5 ошибок в восстановлении здоровья' },
  { timing: 'день 1', text: 'Карта симптомов: 30 сигналов тела' },
  { timing: 'день 2', text: 'Антивоспалительная тарелка + меню' },
  { timing: 'день 3', text: 'Гайд по добавкам нового поколения' },
];
```

Do not normalize currency, dates, punctuation or claims from the approved source.

- [ ] **Step 3: Verify content shape and types**

Run:

```bash
npm run validate:content
npm run check
```

Expected: `content validation passed`; Astro check exits `0`.

---

### Task 4: Build the document layout and centralized motion module

**Files:**
- Create: `src/layouts/Layout.astro`
- Create: `src/lib/motion.ts`
- Create: `tests/layout.spec.ts`
- Modify later: `src/pages/index.astro`

- [ ] **Step 1: Write the failing layout contract**

Create `tests/layout.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('renders production metadata and one motion bootstrap', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Здоровье без таблеток/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /нутрициолог/);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('script[data-landing-motion]')).toHaveCount(1);
});
```

Run:

```bash
npm run test:e2e -- --project=desktop-chromium tests/layout.spec.ts
```

Expected: FAIL because the scaffold has no production metadata or motion bootstrap.

- [ ] **Step 2: Implement the deep layout interface**

Create `src/layouts/Layout.astro` with this frontmatter contract:

```astro
---
import '../styles/global.css';

interface Props {
  title: string;
  description: string;
  image?: string;
}

const {
  title,
  description,
  image = '/og-image.svg',
} = Astro.props;
const canonical = Astro.site ? new URL(Astro.url.pathname, Astro.site) : undefined;
---
```

The document shell must include:

```astro
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>{title}</title>
    <meta name="description" content={description} />
    {canonical && <link rel="canonical" href={canonical} />}
    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={image} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <slot />
    <script data-landing-motion>
      import { initLandingMotion } from '../lib/motion';
      const cleanup = initLandingMotion();
      document.addEventListener('astro:before-swap', cleanup, { once: true });
    </script>
  </body>
</html>
```

- [ ] **Step 3: Implement deterministic motion hooks**

Create `src/lib/motion.ts`:

```ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const selector = [
  '[data-animate="reveal"]',
  '[data-animate="slide-left"]',
  '[data-animate="slide-right"]',
  '[data-animate="scale"]',
].join(',');

export function initLandingMotion(): () => void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = gsap.utils.toArray<HTMLElement>(selector);

  if (reduceMotion) {
    gsap.set(elements, { clearProps: 'all' });
    return () => undefined;
  }

  gsap.registerPlugin(ScrollTrigger);
  const context = gsap.context(() => {
    for (const element of elements) {
      const mode = element.dataset.animate;
      const from = mode === 'slide-left'
        ? { opacity: 0, x: -24 }
        : mode === 'slide-right'
          ? { opacity: 0, x: 24 }
          : mode === 'scale'
            ? { opacity: 0, scale: 0.96 }
            : { opacity: 0, y: 24 };
      gsap.set(element, from);
      gsap.to(element, {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: element, start: 'top 88%', once: true },
      });
    }
  });

  return () => context.revert();
}
```

- [ ] **Step 4: Temporarily wrap the scaffold page and prove the interface**

Modify `src/pages/index.astro` to import `Layout` and render the existing scaffold content inside it. Run:

```bash
npm run check
npm run test:e2e -- --project=desktop-chromium tests/layout.spec.ts
```

Expected: PASS; no page errors.

---

### Task 5: Implement shared UI primitives

**Files:**
- Create: `src/components/ui/Button.astro`
- Create: `src/components/ui/Card.astro`
- Create: `src/components/ui/SectionLabel.astro`
- Create: `tests/ui-primitives.spec.ts`

- [ ] **Step 1: Write the failing primitive states test**

Create `tests/ui-primitives.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('CTA exposes a visible focus state and valid registration anchor', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('link', { name: /место|регистрац/i }).first();
  await expect(cta).toHaveAttribute('href', '#registration');
  await cta.focus();
  await expect(cta).toBeFocused();
  const outline = await cta.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
});
```

Expected before primitives/sections: FAIL because no registration CTA exists.

- [ ] **Step 2: Implement `Button.astro`**

Use the approved interface from the specification. Required invariant:

```astro
<a
  class:list={[baseClasses, variantClasses[variant], fullWidth && 'w-full', className]}
  href={href}
  aria-disabled={disabled ? 'true' : undefined}
  tabindex={disabled ? -1 : undefined}
>
  <slot />
</a>
```

For button rendering use native `disabled`. Variant classes must resolve colors/shadows through variables, never raw hex.

- [ ] **Step 3: Implement `Card.astro` and `SectionLabel.astro`**

`Card.astro` must map `tone` to semantic classes and render only `article | div | li`. `SectionLabel.astro` maps `tone="inverse"` to inverse text. Neither module imports GSAP or marketing content.

- [ ] **Step 4: Keep the test red until Task 6**

Run `npm run check`; expected PASS. The Playwright CTA test remains intentionally failing until `Hero.astro` exists.

---

### Task 6: Implement the above-the-fold vertical slice

**Files:**
- Create: `src/components/Hero.astro`
- Create: `src/components/Hook.astro`
- Create: `src/components/Audience.astro`
- Create: `src/components/DualValue.astro`
- Create: `tests/sections-above-fold.spec.ts`
- Modify: `src/pages/index.astro`
- Source reference: `Maket.html:156-298`

- [ ] **Step 1: Write the failing order/copy test**

Create `tests/sections-above-fold.spec.ts`:

```ts
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
```

Run: `npm run test:e2e -- --project=desktop-chromium tests/sections-above-fold.spec.ts`.
Expected: FAIL; modules do not exist.

- [ ] **Step 2: Implement `Hero.astro` and `Hook.astro`**

Transfer exact content and approved inline SVG from `Maket.html:156-234`. Requirements:
- `Hero` owns the only `h1`.
- Hero CTA uses `Button href="#registration"`.
- Decorative SVG uses `aria-hidden="true"` and `focusable="false"`.
- Hero and hook expose `data-animate` hooks only; no local scripts.

- [ ] **Step 3: Implement `Audience.astro` and `DualValue.astro`**

Transfer `Maket.html:236-298`. `Audience` maps `audienceItems`; `DualValue` retains the two outcome cards and three metrics. Replace inline raw layout styles with variables/Tailwind semantic classes.

- [ ] **Step 4: Compose and verify the vertical slice**

Update `index.astro` with the approved first four section imports/order. Run:

```bash
npm run validate:content
npm run check
npm run test:e2e -- --project=desktop-chromium tests/sections-above-fold.spec.ts tests/ui-primitives.spec.ts
```

Expected: all pass.

---

### Task 7: Implement program, career, stats, and speaker sections

**Files:**
- Create: `src/components/Program.astro`
- Create: `src/components/CareerPath.astro`
- Create: `src/components/Stats.astro`
- Create: `src/components/Speaker.astro`
- Create: `tests/sections-program.spec.ts`
- Modify: `src/pages/index.astro`
- Source reference: `Maket.html:300-468`

- [ ] **Step 1: Write the failing data rendering test**

Create `tests/sections-program.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('renders three complete days and approved proof sections', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#program [data-program-day]')).toHaveCount(3);
  await expect(page.locator('#career [data-career-step]')).toHaveCount(5);
  await expect(page.locator('#stats [data-stat]')).toHaveCount(3);
  await expect(page.getByText('Марина Жигульская')).toBeVisible();
});
```

Expected: FAIL before modules exist.

- [ ] **Step 2: Implement `Program.astro`**

Map `programDays`. Each `article[data-program-day]` contains date, `h3`, hook, complete points list, gift title and description. Preserve three approved inline SVG illustrations; assign decorative semantics.

- [ ] **Step 3: Implement `CareerPath.astro`, `Stats.astro`, `Speaker.astro`**

Map `careerSteps` and `stats`; transfer the exact speaker biography from `Maket.html:458-465`. Do not recalculate, qualify or rewrite numeric claims.

- [ ] **Step 4: Compose and verify**

Insert sections after `DualValue`. Run:

```bash
npm run check
npm run test:e2e -- --project=desktop-chromium tests/sections-program.spec.ts
```

Expected: PASS with counts `3/5/3`.

---

### Task 8: Implement bonuses, non-submitting registration, footer, and sticky CTA

**Files:**
- Create: `src/components/Bonuses.astro`
- Create: `src/components/Registration.astro`
- Create: `src/components/Footer.astro`
- Create: `src/components/StickyCTA.astro`
- Create: `src/lib/registration.ts`
- Create: `tests/registration.spec.ts`
- Modify: `src/pages/index.astro`
- Source reference: `Maket.html:471-551`

- [ ] **Step 1: Write the failing no-send contract**

Create `tests/registration.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('validates locally and never sends registration data', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });

  await page.goto('/');
  await page.getByLabel('Ваше имя').fill('Анна');
  await page.getByLabel('Email').fill('anna@example.com');
  await page.getByLabel('Telegram или WhatsApp').fill('@anna');
  await page.getByRole('button', { name: /регистрац/i }).click();

  await expect(page.getByRole('status')).toHaveText('Форма пока не подключена. Данные не отправлены.');
  expect(posts).toEqual([]);
});
```

Expected: FAIL before registration module exists.

- [ ] **Step 2: Implement the future integration seam**

Create `src/lib/registration.ts` exactly as approved:

```ts
export interface RegistrationPayload {
  name: string;
  email: string;
  messenger: string;
}

export type RegistrationResult =
  | { ok: true }
  | { ok: false; reason: 'not-configured' };

export function submitRegistration(
  _payload: RegistrationPayload,
): RegistrationResult {
  return { ok: false, reason: 'not-configured' };
}
```

- [ ] **Step 3: Implement `Bonuses.astro` and `Registration.astro`**

`Bonuses` maps four `bonuses`. `Registration` maps seven `registrationGifts`, binds labels via `for`/`id`, uses native required/email validation, imports `submitRegistration` in one bundled client script, calls `preventDefault()`, and writes the exact not-configured message into:

```astro
<p role="status" aria-live="polite" data-registration-status></p>
```

Never log payload values. Remove the prototype `alert()` behavior.

- [ ] **Step 4: Implement footer and sticky CTA**

`Footer.astro` preserves school/year text. Until a real policy route exists, render “Политика конфиденциальности” as non-link text rather than `href="#"`. `StickyCTA.astro` links to `#registration`, includes safe-area bottom padding and does not obscure the final form controls.

- [ ] **Step 5: Compose and verify**

Insert `Bonuses`, `Registration`, `Footer`, then `StickyCTA`. Run:

```bash
npm run check
npm run test:e2e -- --project=desktop-chromium tests/registration.spec.ts
```

Expected: PASS; no POST requests.

---

### Task 9: Finalize composition, metadata, and public assets

**Files:**
- Replace: `src/pages/index.astro`
- Create: `public/favicon.svg`
- Create: `public/og-image.svg`
- Create: `public/robots.txt`
- Modify: `astro.config.mjs`
- Create: `tests/composition.spec.ts`

- [ ] **Step 1: Write the failing complete composition test**

Create `tests/composition.spec.ts`:

```ts
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
```

- [ ] **Step 2: Replace the scaffold composition root**

`src/pages/index.astro` must contain only frontmatter imports and this shape:

```astro
<Layout
  title="Здоровье без таблеток: от диагноза к профессии"
  description="Бесплатный трёхдневный марафон школы нутрициологии «Ресурс»."
>
  <main>
    <Hero />
    <Hook />
    <Audience />
    <DualValue />
    <Program />
    <CareerPath />
    <Stats />
    <Speaker />
    <Bonuses />
    <Registration />
    <Footer />
  </main>
  <StickyCTA />
</Layout>
```

- [ ] **Step 3: Add deterministic SVG public assets**

Create `favicon.svg` and `og-image.svg` using only approved token colors from `design-tokens.json`. `og-image.svg` viewport is `1200x630`, contains the school name and landing title, and has no external font dependency.

Create `public/robots.txt`:

```text
User-agent: *
Allow: /
```

- [ ] **Step 4: Make site URL an optional build-time contract**

Modify `astro.config.mjs`:

```js
const site = process.env.PUBLIC_SITE_URL;

export default defineConfig({
  site,
  vite: {
    plugins: [tailwind()],
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  },
});
```

Local builds may omit `PUBLIC_SITE_URL`; Dokploy production builds must set it to the final `https://` origin.

- [ ] **Step 5: Verify composition and production build**

Run:

```bash
npm run validate:content
npm run check
npm run build
npm run test:e2e -- --project=desktop-chromium tests/composition.spec.ts
```

Expected: all pass; `dist/index.html`, `dist/favicon.svg`, `dist/og-image.svg`, and `dist/robots.txt` exist.

---

### Task 10: Add responsive, reduced-motion, accessibility, and performance QA

**Files:**
- Create: `tests/responsive.spec.ts`
- Create: `tests/accessibility.spec.ts`
- Create: `tests/motion.spec.ts`
- Modify affected section modules only when a test exposes a defect

- [ ] **Step 1: Add mobile/desktop layout assertions**

`tests/responsive.spec.ts` must assert:

```ts
import { expect, test } from '@playwright/test';

test('keeps content inside the viewport', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('#registration')).toBeVisible();
});
```

Run on both configured projects. Expected: PASS at Pixel 5 and Desktop Chrome sizes.

- [ ] **Step 2: Add keyboard and semantic assertions**

`tests/accessibility.spec.ts` verifies:
- exactly one `h1`;
- every input has an accessible label;
- CTA links reach `#registration`;
- decorative SVGs are `aria-hidden`;
- Tab traversal reaches CTA and all form controls;
- sticky CTA does not overlap the focused submit button.

Use Playwright `getByRole`/`getByLabel`; do not assert CSS class names.

- [ ] **Step 3: Add reduced-motion assertions**

Create a reduced-motion context:

```ts
test.use({ reducedMotion: 'reduce' });

test('keeps animated content visible when motion is reduced', async ({ page }) => {
  await page.goto('/');
  const hidden = await page.locator('[data-animate]').evaluateAll((elements) =>
    elements.filter((element) => getComputedStyle(element).opacity === '0').length,
  );
  expect(hidden).toBe(0);
});
```

- [ ] **Step 4: Run the complete browser suite**

Run:

```bash
npm run test:e2e
```

Expected: both desktop/mobile projects pass; zero page errors and zero failed requests for local assets.

- [ ] **Step 5: Record release-only performance gates**

Use production preview and Lighthouse during verification, not unit tests. Required thresholds:

```text
Performance >= 90
Accessibility >= 95
CLS <= 0.1
LCP <= 2.5s
```

If any threshold fails, capture the exact metric and fix its source before Task 11.

---

### Task 11: Containerize the static build with nginx

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `nginx.conf`
- Create: `scripts/smoke-container.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the container smoke script first**

Create `scripts/smoke-container.mjs`:

```js
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8080';

for (const [path, expected] of [['/', 'Здоровье без таблеток'], ['/healthz', 'ok']]) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const body = await response.text();
  if (!body.includes(expected)) throw new Error(`${path}: missing ${expected}`);
}

console.log('container smoke passed');
```

Add this key to the `scripts` object in `package.json` during Task 11:

```json
"smoke:container": "node scripts/smoke-container.mjs"
```

Expected before container starts: FAIL with connection refused.

- [ ] **Step 2: Create nginx configuration**

Create `nginx.conf`:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;

  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  add_header X-Frame-Options "DENY" always;

  location = /healthz {
    access_log off;
    default_type text/plain;
    return 200 "ok";
  }

  location = /index.html {
    add_header Cache-Control "no-cache";
    try_files $uri =404;
  }

  location ^~ /_astro/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ =404;
  }
}
```

- [ ] **Step 3: Create the multi-stage Docker build**

Create `Dockerfile`:

```dockerfile
FROM node:22.22.2-alpine AS builder
WORKDIR /app
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1/healthz || exit 1
```

Before production release, resolve `nginx:alpine` to its current multi-arch digest with:

```bash
docker buildx imagetools inspect nginx:alpine
```

Copy the exact manifest digest printed by the command and append it after `nginx:alpine@sha256:` in the runtime `FROM` line. Accept only a 64-character hexadecimal digest; do not invent or truncate it.

- [ ] **Step 4: Keep build context minimal**

Create `.dockerignore`:

```text
.git
.github
.astro
dist
node_modules
MEMORY
docs
Maket.html
Design.md
design-tokens.json
```

Do not ignore `tokens.css`; the Astro build imports it.

- [ ] **Step 5: Build and smoke the container**

Run:

```bash
docker build --build-arg PUBLIC_SITE_URL=https://example.invalid -t zbt-2007:local .
docker run --rm -d --name zbt-2007-smoke -p 127.0.0.1:8080:80 zbt-2007:local
npm run smoke:container
docker inspect --format='{{.State.Health.Status}}' zbt-2007-smoke
docker stop zbt-2007-smoke
```

Expected: smoke passes; health status becomes `healthy`; container stops cleanly. `example.invalid` is intentionally reserved for local smoke and is never used in production.

---

### Task 12: Document and execute Dokploy deployment

**Files:**
- Create: `docs/deployment/dokploy.md`
- Reference: `Dockerfile`, `nginx.conf`

- [ ] **Step 1: Write the exact Dokploy application configuration**

Create `docs/deployment/dokploy.md` with these values:

```text
Resource: Application
Source: project Git repository
Branch: production branch selected by the operator
Build type: Dockerfile
Build context: .
Dockerfile path: Dockerfile
Build argument: PUBLIC_SITE_URL=https://$PRODUCTION_DOMAIN
Container port: 80
Published host ports: none
Health URL: /healthz
Health interval: 30 seconds
Health timeout: 3 seconds
```

`PRODUCTION_DOMAIN` is a required operator input, not a repository default. The runbook must stop if it is empty.

- [ ] **Step 2: Document infrastructure prerequisites**

Runbook prerequisites:

```text
- Dokploy is installed and reachable on the VPS.
- Dokploy can read the repository/production branch.
- DNS A record points PRODUCTION_DOMAIN to the VPS IPv4 address.
- DNS AAAA exists only when IPv6 routing is configured.
- VPS firewall allows inbound TCP 80 and 443.
- No application host port is published; Traefik routes to container port 80.
```

- [ ] **Step 3: Document domain and HTTPS sequence**

Sequence:

```text
1. Verify DNS resolution from outside the VPS.
2. Deploy application and wait for healthy status.
3. Add PRODUCTION_DOMAIN in Dokploy Domains.
4. Set container port 80.
5. Enable HTTPS/Let's Encrypt and HTTP→HTTPS redirect.
6. Verify certificate hostname, issuer and expiry.
```

This matches Dokploy’s Application/Traefik model; do not use Docker Compose labels for this single-container site.

- [ ] **Step 4: Document production smoke and rollback**

Production smoke commands:

```bash
curl --fail --silent --show-error "https://$PRODUCTION_DOMAIN/healthz"
curl --fail --silent --show-error "https://$PRODUCTION_DOMAIN/" | grep -F "Здоровье без таблеток"
```

Rollback procedure:

```text
1. Mark the failed Dokploy deployment and save logs.
2. Select the immediately previous successful deployment/image.
3. Redeploy it without changing DNS.
4. Re-run /healthz and homepage smoke commands.
5. Never patch files inside the running container.
```

- [ ] **Step 5: Link official Dokploy references**

Include:

```text
https://docs.dokploy.com/docs/core/applications
https://docs.dokploy.com/docs/core/domains
https://docs.dokploy.com/docs/core/docker-compose/domains
```

The Compose link is included only to explain why this Application does not use Traefik labels.

---

### Task 13: Run the integrated release gate and update guidance

**Files:**
- Modify: `AGENTS.md`
- Reference unchanged: `Maket.html`
- Generated: `dist/`, Playwright reports, Docker image

- [ ] **Step 1: Run source and browser verification**

Run:

```bash
npm run verify
```

Expected: content validation, Astro check, static build and all Playwright projects pass.

- [ ] **Step 2: Verify source invariants**

Programmatic checks:

```bash
node --experimental-strip-types scripts/validate-content.mjs
```

Additionally verify:

```text
- No raw hex exists under src/ except approved inline SVG artwork.
- No transition: all exists in runtime CSS.
- No section module imports gsap.
- No href="#" exists.
- No POST request occurs during registration test.
- `Maket.html` SHA-256 equals `7d6a9f38752e4ca46f80a8660440a670d5cbf1d8c5a979e23f8608945238a601`.
```

Run the immutable-reference check:

```bash
printf '%s  %s\n' '7d6a9f38752e4ca46f80a8660440a670d5cbf1d8c5a979e23f8608945238a601' 'Maket.html' | shasum -a 256 -c -
```

Expected: `Maket.html: OK`.

Use repository-native search/LSP tools during implementation; do not introduce shell text-rewrite commands.

- [ ] **Step 3: Run production artifact verification**

Run the Task 11 Docker build/smoke sequence with the actual production domain build argument. Expected: `/`, static assets and `/healthz` return `200`; Docker health is `healthy`.

- [ ] **Step 4: Perform browser release checks**

On production URL verify:

```text
- 375px and 1440px layouts.
- Keyboard-only navigation through CTA and form.
- Reduced-motion content remains visible.
- No browser console errors.
- HTTPS certificate is valid.
- Lighthouse Performance >= 90.
- Lighthouse Accessibility >= 95.
- CLS <= 0.1.
- LCP <= 2.5s.
```

- [ ] **Step 5: Update repository guidance last**

Update `AGENTS.md` only after the implementation works. Replace scaffold/current-state language with:

```text
- index.astro is the composition root.
- Layout.astro owns metadata and motion.
- landing.ts owns repeated content.
- tokens.css/design-tokens.json remain design sources.
- npm run verify is the release gate.
- Docker/nginx/Dokploy is the production topology.
- registration is intentionally non-submitting until a receiver is approved.
```

- [ ] **Step 6: Preserve explicit human checks**

Record these unresolved operator inputs in the deployment handoff as required runtime decisions:

```text
PRODUCTION_DOMAIN
Dokploy repository credential selection
Dokploy production branch selection
VPS firewall/DNS access
```

The implementation is complete only when automated gates pass and the operator acknowledges the four deployment inputs.

---

## Execution Order and Review Gates

1. Tasks 1–5: foundation review.
2. Tasks 6–9: visual/content review against `Maket.html` at 375px and 1440px.
3. Task 10: QA review; no deployment work begins while tests fail.
4. Task 11: container review; no Dokploy deployment while local health fails.
5. Task 12: deployment review using actual VPS/domain inputs.
6. Task 13: final integrated verification and guidance update.

## Final Definition of Done

- `npm run verify` passes.
- Docker image builds from a clean context.
- Container health is `healthy`.
- Dokploy reports a healthy deployment.
- HTTPS homepage and `/healthz` return `200`.
- All 11 semantic content modules render in approved order; Sticky CTA reaches registration.
- Registration sends and stores no data and states this inline.
- Design values come from the approved token system.
- `Maket.html` remains an unchanged reference.
- Production operator inputs are recorded and acknowledged.
