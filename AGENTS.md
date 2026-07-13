# Repository Guidelines

## Project Overview

Репозиторий содержит одностраничный лендинг школы нутрициологии «Ресурс», реализованный на Astro. Утверждённый прототип `Maket.html` перенесён в типизированные Astro-компоненты; дизайн-система, browser QA и production-контейнер (Docker/nginx для Dokploy) реализованы и проверяются локально. `Maket.html` остаётся неизменным reference prototype и не входит в Astro build.

Продакшн-развёртывание на VPS через Dokploy описано в runbook, но ещё не выполнено: оно заблокировано отсутствующими operator inputs/access (см. «Production topology» и «Unresolved operator inputs»).

## Architecture & Data Flow

Реализованный поток (проверяется `npm run verify`):

- `src/pages/index.astro` — composition root. Содержит только frontmatter-импорты и композицию 11 секций внутри `Layout.astro`, плюс `Header` (fixed nav-шапка) перед `<main>` и `StickyCTA` как fixed overlay после `<main>`. Порядок секций: `hero → hook → audience → dual-value → program → career → stats → speaker → bonuses → registration → footer`.
- `src/layouts/Layout.astro` — владеет document metadata (title, description, canonical, Open Graph, шрифты, favicon) и единственным motion bootstrap: один framework-processed `<script>` без атрибутов (Astro бандлит его как внешний модуль, а не форсит `is:inline`), который импортирует и один раз вызывает `initLandingMotion()` из `src/lib/motion.ts` и вешает cleanup на `astro:before-swap`. Контракт проверяется ровно одной загрузкой модуля `src/lib/motion` (см. `tests/layout.spec.ts`), а не маркер-атрибутом.
- `src/lib/motion.ts` — централизованный GSAP/ScrollTrigger init: ветка `prefers-reduced-motion` (в reduced-motion контент остаётся видимым, анимации выключены), `gsap.set()` для начального состояния, `gsap.to()` с `once: true`, очистка через `gsap.context().revert()`. Режимы `data-animate`: `reveal`/`slide-left`/`slide-right`/`scale` (анимируют контейнер) и `stagger` (каскад прямых детей). Дополнительно: count-up для `[data-count-up]` (Stats) и entrance fixed-навбара `[data-nav]`. Секционные компоненты объявляют только `data-animate`-хуки и не импортируют GSAP.
- `src/content/landing.ts` — единственный источник повторяемого контента: типизированные `audienceItems`, `programDays`, `careerSteps`, `stats`, `bonuses`, `registrationGifts` с интерфейсами. Контент не нормализуется относительно `Maket.html`.
- `src/components/` — одна секция на один PascalCase `.astro`-файл (`Hero`, `Hook`, `Audience`, `DualValue`, `Program`, `CareerPath`, `Stats`, `Speaker`, `Bonuses`, `Registration`, `Footer`), плюс site-chrome: `Header` (fixed nav со scrollspy и мобильным меню), `StickyCTA` и `RegistrationModal` (поповер со встроенным виджетом регистрации).
- `src/components/ui/` — UI-примитивы (`Button`, `Card`, `SectionLabel`) без бизнес-смысла; не импортируют GSAP или marketing content.
- `src/lib/registration.ts` — legacy integration seam (не подключён к UI); фактический приём заявок идёт через встроенный виджет в `RegistrationModal`.
- `src/styles/global.css` — импортирует `tailwindcss` и корневой `../../tokens.css`, объявляет semantic Tailwind aliases через `@theme inline` и `:focus-visible` outline.
- Data flow статический: Astro компилирует route и CSS в `dist/`; backend, persistence, API, async orchestration, dependency injection и shared state отсутствуют.

## Key Directories

- `src/pages/` — Astro routes; `index.astro` — composition root.
- `src/layouts/` — общий layout и единый GSAP init.
- `src/components/` — секционные компоненты; `src/components/ui/` — UI-примитивы.
- `src/content/` — типизированный повторяемый контент (`landing.ts`).
- `src/lib/` — `motion.ts` (анимации) и `registration.ts` (integration seam).
- `src/styles/` — глобальный Tailwind entry stylesheet.
- `scripts/` — `validate-content.mjs` (проверка формы контента) и `smoke-container.mjs` (container smoke).
- `tests/` — Playwright specs (64 теста на проектах `desktop-chromium` и `mobile-chromium`; включает `tilda-block.spec.ts` — регрессионные проверки standalone-блока `tilda-zbt.html`: секции/контент, отсутствие overflow на 375/1440, изоляция стилей от соседнего контента, фокус, инертность плавающего CTA, загрузка виджета один раз, юр-футер).
- `docs/deployment/` — Dokploy runbook.
- `node_modules/`, `.astro/`, `dist/` — generated artifacts; не редактируйте и не коммитьте.
- `MEMORY/` — служебное состояние PAI, не продуктовый source-каталог.

## Development Commands

Для чистой установки выполните `npm install`; lockfile и runtime pin уже находятся в репозитории.

Основной lifecycle:

```bash
npm run dev      # astro dev
npm run build    # astro build -> dist/
npm run preview  # локальная проверка production build
```

Скрипты верификации:

```bash
npm run validate:content   # node --experimental-strip-types scripts/validate-content.mjs
npm run check              # astro check
npm run test:e2e           # playwright test (desktop + mobile)
npm run smoke:container    # node scripts/smoke-container.mjs (против запущенного контейнера)
```

## Release gate

`npm run verify` — единый release gate. Он последовательно запускает:

```bash
npm run validate:content && npm run check && npm run build && npm run test:e2e
```

Гейт считается зелёным при: `content validation passed`; `astro check` без errors/warnings/hints; успешном static build в `dist/`; и прохождении всех Playwright-проектов (`desktop-chromium` + `mobile-chromium`).

Дополнительные source-инварианты, проверяемые перед релизом:

- Нет raw hex под `src/`, кроме утверждённого inline SVG artwork.
- Нет `transition: all` в runtime CSS.
- Ни один секционный компонент не импортирует `gsap` (GSAP только в `src/lib/motion.ts`).
- Нет `href="#"`.
- Во время registration-теста наш origin (localhost) не отправляет ни одного POST (сабмит принадлежит стороннему виджету регистрации).
- `Maket.html` SHA-256 равен `7d6a9f38752e4ca46f80a8660440a670d5cbf1d8c5a979e23f8608945238a601` (immutable reference).

Release-only performance gates измеряются на production preview/Lighthouse, а не unit-тестами: Performance >= 90, Accessibility >= 95, CLS <= 0.1, LCP <= 2.5s.

## Production topology (Docker/nginx/Dokploy)

- `Dockerfile` — multi-stage build: `node:22.22.2-alpine` собирает `dist/`, затем артефакт копируется в runtime image `nginx:alpine`, закреплённый по digest (`@sha256:...`). `HEALTHCHECK` опрашивает `/healthz`.
- `nginx.conf` — слушает container port 80; отдаёт security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`), gzip, `Cache-Control: no-cache` для `index.html`, `public, max-age=31536000, immutable` для `/_astro/`, и `/healthz` -> `200 ok`.
- `.dockerignore` минимизирует build context и намеренно НЕ игнорирует `tokens.css` (его импортирует Astro build).
- `PUBLIC_SITE_URL` — build-time arg. Локальные build/smoke используют `https://example.invalid` (зарезервировано только для smoke; никогда не выдавать за production). Production build должен получить `PUBLIC_SITE_URL=https://$PRODUCTION_DOMAIN`.
- Dokploy разворачивает Application из Dockerfile, Traefik маршрутизирует домен на container port 80; host-порты не публикуются. HTTPS/сертификат выпускает Let's Encrypt. Точные значения и последовательность — в `docs/deployment/dokploy.md`.

Локальная проверка контейнера (образец, `example.invalid` только для smoke):

```bash
docker build --build-arg PUBLIC_SITE_URL=https://example.invalid -t zbt-2007:local .
docker run --rm -d --name zbt-2007-smoke -p 127.0.0.1:8080:80 zbt-2007:local
SMOKE_BASE_URL=http://127.0.0.1:8080 npm run smoke:container
docker inspect --format='{{.State.Health.Status}}' zbt-2007-smoke   # -> healthy
docker stop zbt-2007-smoke
```

## Registration

Регистрация идёт через сторонний виджет-форму GetCourse (`iandmyhealth.ru`), встроенную в модальное окно `RegistrationModal`. Все CTA «Забрать место» (Hero, StickyCTA, шапка, кнопка в секции `#registration`) по клику открывают этот поповер (делегированный listener по `a[href="#registration"]`, `#registration button`, `[data-registration-open]`; `preventDefault` для якорей). Виджет грузится лениво при первом открытии (до клика внешняя сеть не задействуется) и сам сабмитит данные на свою платформу — наш origin ничего не постит. Секция `#registration` остаётся информационной (заголовок + список подарков + кнопка-триггер). `src/lib/registration.ts` — неиспользуемый legacy-seam.

## Unresolved operator inputs (production, BLOCKED)

Следующие входы — обязательные runtime-решения оператора; в репозитории их нет и подставлять дефолты нельзя:

- `PRODUCTION_DOMAIN`
- Dokploy repository credential selection
- Dokploy production branch selection
- VPS firewall/DNS access

Пока эти входы/доступ не предоставлены, продакшн-операции остаются НЕ выполненными и НЕ подтверждёнными: реальный Dokploy deploy и его healthy-статус, валидность production HTTPS-сертификата, внешнее DNS-разрешение домена и production smoke (`https://$PRODUCTION_DOMAIN/healthz` и главная) — заблокированы. Не заявляйте их пройденными без соответствующих operator inputs/access. Реализация считается завершённой только когда автоматические гейты зелёные И оператор подтвердил эти четыре входа.

## Code Conventions & Common Patterns

- Основной контент и комментарии — на русском; технические имена, API и identifiers — на английском.
- CSS classes и custom properties используют kebab-case: `.reg-bonus-card`, `--color-rose-deep`.
- Astro-компоненты используют PascalCase: `Hero.astro`, `StickyCTA.astro`; props и локальные переменные — camelCase.
- `design-tokens.json`/`tokens.css` — источники повторно используемых значений. Не размножайте raw colors, spacing и radii из prototype inline styles; исключение — утверждённый inline SVG artwork.
- W3C token leaves имеют `$type` и `$value`; spacing следует 4px scale.
- Responsive typography использует `clamp()`.
- UI-компоненты объявляют animation classes через `data-animate`; GSAP централизован в `src/lib/motion.ts` (bootstrap — в `Layout.astro`).
- Для reveal сначала задавайте начальное состояние через `gsap.set()`, затем `gsap.to()`; используйте `once: true` и ветку `prefers-reduced-motion`.
- Не анимируйте `width`, `height`, `top` или `left`; не используйте `transition: all`.
- У проекта нет установленных паттернов error handling, async orchestration, dependency injection или shared state. Добавляйте их только вместе с конкретным runtime-контрактом.

## Important Files

- `package.json` / `package-lock.json` — manifest, scripts и воспроизводимая npm dependency graph.
- `astro.config.mjs` / `tsconfig.json` — Tailwind Vite integration, strict TypeScript, `@/*` alias; `site` берётся из optional `PUBLIC_SITE_URL`.
- `.nvmrc` — Node `22.22.2`.
- `Maket.html` — неизменный reference prototype (immutable; сверяется по SHA-256).
- `Design.md` — визуальная философия, типографика, spacing, components и правила использования токенов.
- `design-tokens.json` — машиночитаемые W3C design tokens.
- `tokens.css` — CSS variables и базовые `.btn-cta`, `.card`, `.eyebrow`, `.section-title`, `.chip` patterns; импортируется через `src/styles/global.css`.
- `Dockerfile` / `nginx.conf` / `.dockerignore` — production container topology.
- `docs/deployment/dokploy.md` — Dokploy runbook и последовательность HTTPS.
- `tilda-zbt.html` — блок лендинга для вставки в Tilda (T123): весь дизайн/вёрстка/логика в одном файле, CSS изолирован под `.zbt` (значения из `tokens.css`), шапка-меню, встроенный виджет регистрации GetCourse. Фотографии хранятся в `tilda-assets/` этого репозитория и отдаются по прямым ссылкам через CDN jsDelivr (`cdn.jsdelivr.net/gh/<owner>/<repo>@main/tilda-assets/…`; репозиторий должен быть публичным). Контент/структура сверяются с текущими компонентами `src/` и `src/content/landing.ts`.
- `tilda-assets/` — оптимизированные фото для `tilda-zbt.html` (генерируются из `src/assets/` через `scripts/build-tilda-assets.mjs`). `tilda-zbt.preview.html` — локальный предпросмотр (ссылки на CDN заменены на локальные файлы).
- `README-TILDA.md` — установка `tilda-zbt.html` в Tilda и его устройство.
- `scripts/build-tilda-assets.mjs` — оптимизатор фото для `tilda-assets/`.

## Runtime/Tooling Preferences

- Runtime закреплён: Node `22.22.2` (`.nvmrc`), npm `10.9.7`, ESM (`"type": "module"`).
- Установлены Astro `7.0.7`, Tailwind CSS `4.2.4`, `@tailwindcss/vite` `4.2.4`, GSAP `3.15.0`; dev-инструменты `@astrojs/check`, `typescript`, `@playwright/test`. Версии фиксирует `package-lock.json`.
- Используйте npm и не смешивайте package managers.
- Tailwind v4 подключается Vite plugin; не добавляйте `tailwind.config.js`, PostCSS integration или `@astrojs/tailwind`.
- TypeScript расширяет `astro/tsconfigs/strict` и использует alias `@/* -> src/*`.
- Build output статический (`dist/`); в production он отдаётся nginx из Docker image (см. «Production topology»).

## Testing & QA

- Автоматизированный gate — `npm run verify` (см. «Release gate»). Playwright покрывает: production metadata и single motion bootstrap, design-tokens, порядок и полноту секций, доступность и keyboard-навигацию, reduced-motion видимость, responsive (нет горизонтального overflow), и no-send registration.
- Playwright проекты: `desktop-chromium` (Desktop Chrome) и `mobile-chromium` (Pixel 5); dev-сервер поднимается автоматически из `playwright.config.ts`.
- Release-проверки на production preview/Lighthouse (не unit-тесты): раскладки 375px и 1440px, keyboard-only навигация до CTA регистрации, видимость контента при reduced motion, отсутствие console errors, и пороги Performance/Accessibility/CLS/LCP из «Release gate».
- Container QA: `npm run smoke:container` против запущенного образа плюс Docker health `healthy`.
- Не документируйте и не запускайте `lint`/`typecheck`/`test` как отдельные команды, пока соответствующие scripts/configs реально не добавлены.
