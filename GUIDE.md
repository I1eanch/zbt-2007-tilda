# Гайд: одностраничный лендинг-интенсив

Инструкция для агента, который собирает **новый** лендинг по образцу этого проекта.

Контент, цветовая схема и набор секций у вас будут **свои**. Здесь — стек, архитектура,
система токенов, UI-примитивы и полный каталог анимационных блоков. Всё, что в этом
документе выглядит как конкретное значение цвета или текст — плейсхолдер.

---

## 1. Стек

| Слой | Технология | Почему |
|---|---|---|
| Фреймворк | **Astro 6** (`astro@^6.2.2`) | Zero-JS по умолчанию, `.astro`-компоненты, встроенная оптимизация картинок |
| Стили | **Tailwind CSS v4** (`tailwindcss@^4.2.4`) | Токены живут в CSS через `@theme`, без `tailwind.config.js` |
| Интеграция Tailwind | **`@tailwindcss/vite`** | В v4 это Vite-плагин, **не** PostCSS и **не** `@astrojs/tailwind` |
| Анимации | **GSAP 3** + **ScrollTrigger** (`gsap@^3.15.0`) | Единый scroll-движок для reveal, scrub, оркестровок |
| Изображения | `astro:assets` (`<Image />`) | Автоматический WebP, размеры, lazy |
| Раздача | **nginx** в multi-stage Docker | Статика, gzip, immutable-кэш |

Зависимостей ровно четыре. Ни React, ни Vue, ни client-роутера. Весь интерактив —
два `<script>`-блока: глобальный GSAP-инит в лейауте и локальный аккордеон в FAQ.

```jsonc
// package.json
{
  "type": "module",
  "scripts": { "dev": "astro dev", "build": "astro build", "preview": "astro preview" },
  "dependencies": {
    "@tailwindcss/vite": "^4.2.4",
    "astro": "^6.2.2",
    "gsap": "^3.15.0",
    "tailwindcss": "^4.2.4"
  }
}
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: { plugins: [tailwindcss()], server: { allowedHosts: true } },
});
```

```jsonc
// tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } }
}
```

---

## 2. Структура проекта

```
src/
  assets/img/           # исходники картинок — обрабатываются astro:assets
  components/
    ui/                 # примитивы без бизнес-смысла
      Button.astro
      Badge.astro
      SectionLabel.astro
    Nav.astro           # секции-компоненты: одна секция = один файл
    Hero.astro
    …
    StickyCTA.astro
  layouts/
    Layout.astro        # <head>, глобальные стили, ЕДИНСТВЕННЫЙ GSAP-инит
  pages/
    index.astro         # только импорт и порядок секций
    oferta.astro        # юридическая страница
  styles/
    global.css          # @theme-токены + CSS-анимации
public/
  favicon.svg
```

`index.astro` не содержит ни строчки разметки — только сборку:

```astro
---
import Layout from '../layouts/Layout.astro';
import Nav from '../components/Nav.astro';
/* … */
---
<Layout>
  <Nav />
  <Hero />
  {/* … секции по порядку … */}
  <StickyCTA />
</Layout>
```

Это даёт дешёвую перестановку секций — главное свойство лендинга, который будут
A/B-тестировать.

---

## 3. Система токенов

Всё живёт в `src/styles/global.css` внутри `@theme`. Tailwind v4 автоматически
генерирует утилиты из имён переменных: `--color-brand-accent` → `bg-brand-accent`,
`text-brand-accent`, `border-brand-accent`.

```css
@import "tailwindcss";

@theme {
  /* Чернила и инверсия */
  --color-ink:            /* основной текст */;
  --color-primary:        /* тёмная кнопка */;
  --color-on-primary:     /* текст на тёмном/цветном */;
  --color-on-dark-soft:   /* приглушённый текст на тёмном */;

  /* Иерархия текста — четыре ступени, не больше */
  --color-body:           /* основной абзац */;
  --color-body-strong:    /* лид-абзац */;
  --color-muted:          /* подписи */;
  --color-muted-soft:     /* дисклеймеры, зачёркнутая цена */;

  /* Поверхности — четыре ступени светлого + одна тёмная */
  --color-canvas:         /* пол страницы */;
  --color-surface-soft:   /* чередующаяся секция */;
  --color-surface-card:   /* карточки */;
  --color-surface-strong: /* акцентная полоса */;
  --color-surface-dark:   /* финальный CTA + футер */;

  /* Бренд — один ГЛАВНЫЙ акцент + 4–5 вспомогательных */
  --color-brand-accent:       /* ВСЕ CTA, все подчёркивания, все лейблы */;
  --color-brand-accent-deep:  /* hover главного акцента */;
  --color-brand-accent-light: /* фон бейджа */;
  --color-brand-2: …;  --color-brand-3: …;  --color-brand-4: …;

  /* Семантика */
  --color-success: …;  --color-warning: …;  --color-error: …;

  /* Границы */
  --color-border:    rgba(0,0,0,0.08);
  --color-border-md: rgba(0,0,0,0.14);
  --color-hairline:  /* сплошная 1px линия */;

  /* Шрифты */
  --font-sans:    'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Playfair Display', Georgia, serif;

  /* Тени — минимум */
  --shadow-card: 0px 2px 8px rgba(0,0,0,0.06), 0px 1px 2px rgba(0,0,0,0.04);
  --shadow-btn:  0px 1px 3px rgba(0,0,0,0.08);

  /* Трекинг для крупных заголовков */
  --tracking-display-lg: -2px;
  --tracking-display-md: -1px;

  /* Радиусы */
  --rounded-md: 12px;  --rounded-lg: 16px;  --rounded-xl: 24px;
}
```

### Правила палитры

1. **Ровно один акцентный цвет** несёт все призывы к действию. В этом проекте — кораллово-красный.
   Кнопка, подчёркивание, рукописная обводка, лейбл секции, hover ссылки в футере — всё им.
2. **Полотно — не чистый белый.** Тёплый или холодный оттенок белого задаёт характер за один токен.
3. **Тёмная поверхность используется дважды подряд** — финальный CTA и футер. Это визуальная
   «точка» в конце скролла.
4. Прозрачности акцента задавайте слэш-нотацией: `bg-brand-accent/[0.06]`, `border-brand-accent/25`.
   Не заводите отдельные токены под каждую альфу.

### Чередование фонов секций

Ритм важнее конкретных цветов. Секции идут по циклу:

```
canvas → canvas → surface-soft → surface-soft → canvas → surface-card → canvas → surface-dark
```

Две одинаковые подряд — норма. Три — уже плоско.

---

## 4. Типографика

Пара из двух шрифтов, подключается одним `<link>` в `<head>`:

- **Sans** (Inter) — всё: заголовки, текст, кнопки, лейблы.
- **Display serif** (Playfair Display, italic) — очень редко, `font-display`.
  В этом проекте — ровно один подзаголовок в герое. Такой шрифт работает как приправа.

Веса грузите только те, что используете: `wght@400;500;600;700;800`.

### Размеры через `clamp()`, а не через брейкпоинты

```html
<!-- h1 -->
<h1 class="text-[clamp(32px,5vw,52px)] font-semibold
           tracking-[--tracking-display-lg] leading-[1.1] text-ink">

<!-- h2 всех секций — один и тот же класс -->
<h2 class="text-[clamp(26px,4vw,42px)] font-semibold
           tracking-[--tracking-display-md] leading-[1.15] text-ink mb-3">
```

Отрицательный трекинг на крупных кеглях обязателен — без него заголовок рассыпается.
Мелкий текст (`≤16px`) трекинг не трогает.

---

## 5. UI-примитивы

Три компонента в `src/components/ui/`. Больше не нужно.

### `Button.astro`

Полиморфный: с `href` рендерит `<a>`, без — `<button>`.

```astro
---
interface Props {
  variant?: 'primary' | 'accent' | 'outline' | 'ghost';
  href?: string;
  fullWidth?: boolean;
  class?: string;
}
const { variant = 'primary', href, fullWidth = false, class: className = '' } = Astro.props;

const base = 'inline-block text-center font-sans font-semibold text-[14px] rounded-[12px] \
cursor-pointer transition-[color,background-color,border-color,opacity,transform] duration-200 no-underline';

const variants: Record<string, string> = {
  primary: 'bg-primary text-on-primary px-6 py-3 shadow-btn hover:opacity-90',
  accent:  'bg-brand-accent text-on-primary px-8 py-4 shadow-[0_6px_24px_rgba(R,G,B,0.25)] \
hover:bg-brand-accent-deep hover:-translate-y-0.5',
  outline: 'border border-border-md bg-transparent text-ink px-6 py-3 hover:bg-surface-card',
  ghost:   'bg-transparent text-ink px-3 py-1.5 hover:bg-surface-card',
};
const classes = `${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`.trim();
---
{href ? <a href={href} class={classes}><slot /></a> : <button class={classes}><slot /></button>}
```

Обратите внимание на `transition-[color,background-color,border-color,opacity,transform]` —
перечисление свойств вместо `transition: all`. Это не педантизм: `all` заставляет браузер
пересчитывать раскладку на каждом hover.

### `Badge.astro`

Капсула с заглавными буквами: `text-[10px] font-bold tracking-[1px] uppercase px-3.5 py-1 rounded-full`.
Варианты: `accent | dark | success | muted`.

### `SectionLabel.astro`

Надзаголовок секции: `text-[12px] font-semibold tracking-[1.5px] uppercase text-brand-accent mb-3`.
Проп `dark` переключает цвет для секций на тёмном фоне.

---

## 6. Скелет секции

Каждая секция построена по одной схеме. Скопируйте, поменяйте наполнение.

```astro
---
import SectionLabel from './ui/SectionLabel.astro';
---
<section class="relative overflow-hidden bg-surface-soft">
  <!-- декоративное свечение: радиальный градиент, вынесен за границы -->
  <div class="absolute top-[-40px] right-[-60px] w-[300px] h-[300px] rounded-full pointer-events-none"
       style="background: radial-gradient(circle, rgba(R,G,B,0.05) 0%, transparent 70%);"></div>

  <div class="max-w-[960px] mx-auto px-8 py-20 relative z-10">
    <SectionLabel>Надзаголовок</SectionLabel>

    <h2 class="rv text-[clamp(26px,4vw,42px)] font-semibold
               tracking-[--tracking-display-md] leading-[1.15] text-ink mb-3">
      Заголовок с <em class="animated-underline-wrap text-brand-accent italic">акцентом</em>
    </h2>

    <p class="rv text-[16px] text-body leading-relaxed max-w-[600px] mb-8">Подзаголовок.</p>

    <div class="stagger-grid grid …">…</div>
  </div>
</section>
```

Константы, которые не меняются нигде: `max-w-[960px]`, `px-8`, `py-20`, `mx-auto`.
Контейнер узкий намеренно — лендинг читается в одну колонку.

### Нарративный скелет (без контента)

Порядок секций — это воронка. Замените смысл, сохраните функцию:

1. `Nav` — фиксированная, 60px, с CTA справа
2. `Hero` — оффер + чек-лист выгод + CTA + визуал
3. `Pain` — «узнаёте себя?», карточки боли
4. `WhyOneStep` — почему ваш подход, сравнение «типично / у нас»
5. `WhySugar` — механика проблемы + счётчики-цифры
6. `Results` — отзывы
7. `TeamSupport` — снятие возражения «не справлюсь один»
8. `Speakers` — авторитет: лид-эксперт крупно + сетка команды
9. `Program` — таймлайн по дням/шагам
10. `WhatsIncluded` — состав продукта
11. `Pricing` — один тариф, зачёркнутая цена, список, CTA
12. `FAQ` — аккордеон, снятие последних возражений
13. `FinalCTA` — на тёмном, повтор оффера
14. `Footer` — реквизиты, юр. ссылки
15. `StickyCTA` — фиксированная кнопка внизу, только мобильные

---

## 7. Анимации — ядро системы

Четыре слоя. Не смешивайте их между собой.

| Слой | Инструмент | Где живёт |
|---|---|---|
| 1. Reveal-утилиты | GSAP + ScrollTrigger | `Layout.astro`, класс на элементе |
| 2. Именные оркестровки | GSAP + ScrollTrigger | `Layout.astro`, привязка к конкретной секции |
| 3. Непрерывные циклы | CSS `@keyframes` | `global.css` |
| 4. Отрисовка SVG | GSAP + `getTotalLength()` | `Layout.astro` + инлайн-SVG |

### Архитектурное правило

**Один `<script>` на весь сайт.** Он лежит в конце `<body>` в `Layout.astro`, импортирует
GSAP, регистрирует ScrollTrigger и вешает все анимации по классам. Компоненты не содержат
JS — они только объявляют классы. Это значит: чтобы оживить новый элемент, вы добавляете
класс, а не пишете скрипт.

```astro
<!-- layouts/Layout.astro -->
<script>
  import { gsap } from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';
  gsap.registerPlugin(ScrollTrigger);
  /* … все блоки ниже … */
</script>
```

Astro сам соберёт этот скрипт в бандл и захэширует.

### Слой 1 — reveal-утилиты

Четыре класса покрывают 80% появлений. Паттерн всегда одинаков:
`gsap.set()` задаёт **стартовое** состояние, `gsap.to()` — целевое.

> **Порядок обязателен.** Без `gsap.set()` элемент успеет отрисоваться в финальном
> состоянии до срабатывания триггера — получите вспышку контента.

```js
// .rv — базовое появление снизу
const rvEls = gsap.utils.toArray('.rv');
gsap.set(rvEls, { opacity: 0, y: 24 });
rvEls.forEach((el) => {
  gsap.to(el, {
    y: 0, opacity: 1, duration: 0.7, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 88%', once: true },
  });
});
```

| Класс | Из | В | duration | ease | start |
|---|---|---|---|---|---|
| `.rv` | `opacity:0, y:24` | `opacity:1, y:0` | 0.7 | `power2.out` | `top 88%` |
| `.stagger-grid` | дети: `opacity:0, y:20` | `opacity:1, y:0` | 0.5, stagger 0.08 | `power2.out` | `top 85%` |
| `.scale-in` | `opacity:0, scale:0.92` | `opacity:1, scale:1` | 0.8 | `power2.out` | `top 88%` |
| `.slide-left` | `opacity:0, x:-40` | `opacity:1, x:0` | 0.7 | `power2.out` | `top 88%` |
| `.slide-right` | `opacity:0, x:40` | `opacity:1, x:0` | 0.7 | `power2.out` | `top 88%` |

`.stagger-grid` вешается на **контейнер**, анимирует `grid.children` — не нужно помечать
каждую карточку.

Три инварианта:
- `once: true` — reveal не переигрывается при обратном скролле;
- `start: 'top 8x%'` — элемент начинает появляться, когда его верх заходит на 12–15% высоты вьюпорта;
- `scale` никогда не стартует с `0` — минимум `0.85`. Ничто в реальном мире не возникает из ничего.

### Слой 2 — именные оркестровки

Привязаны к конкретным элементам. Полный каталог:

| Блок | Селектор | Эффект | Параметры |
|---|---|---|---|
| Параллакс свечений | `.hero-glow, .deco-glow` | `y: -40` | `scrub: 1.5`, `start: top bottom`, `end: bottom top` |
| Счётчики цифр | `[data-count]` | 0 → N | 1.5s, `power2.out`, `toLocaleString('ru-RU')` |
| Линия таймлайна | `.timeline-line` | `scaleY: 0 → 1` | `scrub: 1`, `transformOrigin: top`, 2s |
| Маркеры дней | `.day-marker` | `scale: 0.5 → 1` | 0.5s, **`back.out(1.7)`** |
| Эмодзи боли | `.pain-emoji` | `scale: 0.4 → 1` | 0.5s, **`back.out(2)`** |
| Аватары спикеров | `.speaker-avatar` | `scale: 0.8 → 1` | 0.6s, `power2.out` |
| Кавычки отзыва | `.quote-mark` | `opacity+scale+y` | 0.6s, delay 0.3 |
| Чек-лист героя | `.hero-checks` (дети) | `x: -16 → 0` | 0.4s, stagger 0.08, delay 0.5 — **без ScrollTrigger** |
| Стаггер FAQ | `.faq-stagger` (дети) | `y: 16 → 0` | 0.4s, stagger 0.06 |
| Пульс CTA | `.cta-pulse` | `boxShadow` yoyo | `repeat: -1`, `sine.inOut`, 1.5s |
| Sticky-кнопка | `.sticky-cta` | `yPercent: 100 → 0` | триггер `.hero-section` `bottom 70%` |
| Карточка цены | `.pricing-card` | оркестровка из 3 шагов | см. ниже |

**`back.out(n)`** — единственное «пружинистое» easing в системе. Держите его только для
мелких круглых объектов (маркеры, эмодзи, аватары). На карточках и текстовых блоках оно
читается как дребезг.

**Sticky CTA** — единственная анимация, реагирующая на обратный скролл:

```js
const stickyCTA = document.querySelector('.sticky-cta');
if (stickyCTA) {
  gsap.set(stickyCTA, { yPercent: 100 });
  ScrollTrigger.create({
    trigger: '.hero-section',
    start: 'bottom 70%',
    onEnter:      () => gsap.to(stickyCTA, { yPercent: 0,   duration: 0.4, ease: 'power2.out' }),
    onLeaveBack:  () => gsap.to(stickyCTA, { yPercent: 100, duration: 0.3, ease: 'power2.in'  }),
  });
}
```

Уход быстрее прихода (0.3 против 0.4) — стандартная асимметрия: реакция на действие
пользователя должна ощущаться мгновенной.

**Карточка цены** — трёхтактная оркестровка, единственное место, где стоит такая сложность.
Она отрабатывает один раз за сессию, поэтому дороже по вниманию можно:

```js
const pricingCard = document.querySelector('.pricing-card');
if (pricingCard) {
  const featureItems = pricingCard.querySelectorAll('.pricing-features li');
  ScrollTrigger.create({
    trigger: pricingCard, start: 'top 88%', once: true,
    onEnter: () => {
      // такт 1 (0.9s): блик проходит по карточке — после того, как .scale-in завершился
      gsap.delayedCall(0.9, () => pricingCard.classList.add('shimmer-active'));
      // такт 2 (0.5s): пункты списка выезжают слева
      gsap.to(featureItems, { opacity: 1, x: 0, duration: 0.4, stagger: 0.07, ease: 'power2.out', delay: 0.5 });
      // такт 3 (1.6s): рамка дважды пульсирует свечением
      gsap.delayedCall(1.6, () => pricingCard.classList.add('glow-active'));
    },
  });
}
```

Приём: **GSAP управляет временем, CSS — самим эффектом.** JS только вешает класс,
`@keyframes` делает работу. Так блик и свечение остаются на композиторе.

### Слой 3 — непрерывные CSS-циклы

Эти анимации не имеют конца и не должны идти через JS.

```css
/* Дыхание свечения в герое */
@keyframes breathe { 0%, 100% { opacity: 0.06; } 50% { opacity: 0.12; } }
.hero-glow { animation: breathe 8s ease-in-out infinite; }

/* Бегущая строка из пилюль — два ряда навстречу */
@keyframes marquee-l { from { transform: translateX(0);    } to { transform: translateX(-50%); } }
@keyframes marquee-r { from { transform: translateX(-50%); } to { transform: translateX(0);    } }
.marquee-left  { animation: marquee-l 25s linear infinite; }
.marquee-right { animation: marquee-r 25s linear infinite; }
.marquee-left:hover, .marquee-right:hover { animation-play-state: paused; }
```

Marquee требует **дублирования содержимого** (в разметке контент повторён 4 раза) и
маски по краям:

```html
<div class="overflow-hidden"
     style="mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);">
  <div class="marquee-left flex gap-2.5 w-max">
    {[...Array(4)].map(() => (<><span>Пилюля 1</span><span>Пилюля 2</span></>))}
  </div>
</div>
```

Сдвиг ровно на `-50%` при контенте, повторённом чётное число раз, даёт бесшовный цикл.

**Аккордеон FAQ без JS-измерений.** Классический `max-height` даёт рваную анимацию.
Трюк с `grid-template-rows: 0fr → 1fr` анимирует высоту нативно:

```css
.faq-answer          { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.4s ease; }
.faq-answer > *      { overflow: hidden; }
.faq-item.open .faq-answer { grid-template-rows: 1fr; }
.faq-item.open .faq-toggle { background: var(--color-brand-accent);
                             color: var(--color-on-primary);
                             transform: rotate(45deg); }  /* «+» превращается в «×» */
```

JS остаётся тривиальным (это единственный локальный скрипт в проекте):

```js
document.querySelectorAll('.faq-item').forEach((item) => {
  item.querySelector('button')?.addEventListener('click', () => {
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach((i) => i.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});
```

**Блик и свечение карточки цены** (запускаются классом из слоя 2):

```css
.pricing-card::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(105deg, transparent 40%,
              rgba(255,255,255,.6) 45%, rgba(255,255,255,.6) 50%, transparent 55%);
  background-size: 300% 100%; background-position: 100% 0;
  z-index: 2; pointer-events: none; opacity: 0;
}
.pricing-card.shimmer-active::before { animation: shimmerSweep .8s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes shimmerSweep {
  0%   { background-position: 100% 0;  opacity: 1; }
  100% { background-position: -50% 0;  opacity: 0; }
}

.pricing-card.glow-active { animation: borderGlow 2.5s ease-in-out 2; }
@keyframes borderGlow {
  0%, 100% { box-shadow: 0 0 0 0    rgba(R,G,B,0);   }
  50%      { box-shadow: 0 0 20px 4px rgba(R,G,B,.25); }
}
```

**Подъём карточки на hover** — только `transform` и `box-shadow`, перечисленные явно:

```css
.card-hover        { transition: transform .25s ease, box-shadow .25s ease; }
.card-hover:hover  { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,.08); }
```

### Слой 4 — отрисовка SVG

Две подписи-акцента, которые «рисуются» при появлении. Механика одна: длина пути
измеряется через `getTotalLength()`, затем `strokeDashoffset` уводится в ноль.

```js
document.querySelectorAll('.hand-circle-path').forEach((path, i) => {
  const len = path.getTotalLength();
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
  gsap.to(path, {
    strokeDashoffset: 0, duration: 2,
    delay: i === 0 ? 0.8 : 0.3,        // первая обводка в герое ждёт остальной контент
    ease: 'power2.inOut',
    scrollTrigger: { trigger: path, start: 'top 90%', once: true },
  });
});
```

**Рукописная обводка слова** — SVG абсолютно позиционируется поверх текста, чуть больше него:

```html
<span class="hand-circle-wrap text-brand-accent italic">
  <span class="hand-circle-text">слово</span>
  <svg class="hand-circle-svg" viewBox="0 0 300 100" fill="none">
    <path class="hand-circle-path"
          d="M 270 18 C 300 40, 295 75, 240 88 C 180 102, 20 98, 8 58
             C -2 22, 60 4, 150 6 C 240 8, 278 22, 275 32"
          stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</span>
```

```css
.hand-circle-wrap { position: relative; display: inline-block; margin: 0 .05em; }
.hand-circle-text { position: relative; z-index: 1; }
.hand-circle-svg  { position: absolute; top: 50%; left: 50%;
                    width: calc(100% + .5em); height: calc(100% + .6em);
                    transform: translate(-50%, -50%);
                    z-index: 0; pointer-events: none; overflow: visible;
                    color: var(--color-brand-accent); opacity: .85; }
.hand-circle-path { stroke-dasharray: 600; stroke-dashoffset: 600; }  /* анти-вспышка */
```

Незамкнутая кривая (конец не совпадает с началом) — то, что делает обводку «от руки».
`overflow: visible` обязателен, иначе штрих обрежется по viewBox.

**Волнистое подчёркивание** — то же самое, но проще: путь `Q`-кривых, 1.5s, `power2.inOut`.
Это самый переиспользуемый декор в проекте: он стоит в шести секциях подряд.

```html
<em class="animated-underline-wrap text-brand-accent italic">
  фраза
  <svg class="animated-underline-svg" viewBox="0 0 300 20" fill="none">
    <path class="animated-underline-path"
          d="M 0,10 Q 40,2 80,10 Q 120,18 160,10 Q 200,2 240,10 Q 280,18 300,10"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none" />
  </svg>
</em>
```

### Обязательные правки перед продакшеном

Текущая реализация имеет три известных проблемы. Не воспроизводите их.

**1. `.cta-pulse` анимирует `box-shadow` бесконечно.** `box-shadow` — свойство слоя paint.
Бесконечный цикл заставляет браузер перерисовывать кнопку каждый кадр, на слабых Android
это стоит заметного FPS. Замените на псевдоэлемент с готовой тенью и анимируйте его `opacity`:

```css
.cta-pulse { position: relative; }
.cta-pulse::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit;
  box-shadow: 0 8px 36px rgba(R,G,B,.4);
  opacity: 0; pointer-events: none;
  animation: ctaPulse 1.5s ease-in-out infinite alternate;
}
@keyframes ctaPulse { to { opacity: 1; } }
```

**2. Свечения — крупные полупрозрачные градиенты, которые ездят по `scrub`.** Это допустимо,
потому что двигается `transform: translateY` (композитор). Но не добавляйте к ним
анимацию `filter: blur()` — блюр на больших поверхностях в непрерывном цикле убивает
производительность. Если нужен блюр — до 8px и только разово.

**3. Нет уважения к `prefers-reduced-motion`.** Добавьте в `global.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

И в начале GSAP-скрипта — ранний выход, который сразу показывает контент:

```js
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  gsap.set('.rv, .scale-in, .slide-left, .slide-right, .stagger-grid > *',
           { opacity: 1, x: 0, y: 0, scale: 1 });
} else {
  /* … весь код анимаций … */
}
```

### Что анимировать нельзя

- `width`, `height`, `top`, `left` — вызывают layout каждый кадр.
- `transition: all` — браузер отслеживает все свойства и ловит незапланированные переходы.
- `filter: blur()` в бесконечном цикле на крупных элементах.
- Анимация от `scale(0)`.
- CSS-переменные внутри драг-жестов — пересчёт наследуется всем детям.

Разрешено без оговорок: `transform`, `opacity`. Условно — `color`, `background-color`
на мелких элементах (переключатель FAQ, ссылки).

---

## 8. Ресурсы

### Шрифты

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800&display=swap" rel="stylesheet" />
```

Оба `preconnect` обязательны — `gstatic` отдаёт сами файлы шрифтов.

### Изображения

Кладите исходники в `src/assets/img/`, не в `public/`. Тогда работает `astro:assets`:

```astro
---
import { Image } from 'astro:assets';
import heroPlate from '../assets/img/hero-plate.png';
---
<Image src={heroPlate} alt="Осмысленный alt" class="w-full block" />
<!-- главная картинка героя — без lazy -->
<Image src={heroBg} alt="" loading="eager" class="absolute inset-0 w-full h-full object-cover opacity-25" />
```

Декоративные фоны получают `alt=""` и `pointer-events-none`.

Фон героя — акварельная текстура под тремя слоями: сама картинка на `opacity-25`,
поверх полупрозрачное полотно `bg-canvas/65`, снизу градиент в `canvas`, растворяющий
нижние 40%. Так текстура читается, но не мешает тексту.

### Favicon и аналитика

`public/favicon.svg` + строка в `<head>`. Счётчик — один `<script defer>`:

```html
<script defer src="https://cloud.umami.is/script.js" data-website-id="…"></script>
```

### Мета

Лейаут принимает `title` и `description` как пропсы с дефолтами и раскладывает их
в `<title>`, `<meta name="description">` и три `og:`-тега. `<html lang="ru">`.
`viewport` содержит `viewport-fit=cover` — без этого не работает `env(safe-area-inset-bottom)`
в `StickyCTA`.

---

## 9. Мобильное поведение

Мобильный — это не «десктоп поуже». Три различия:

1. **`StickyCTA`** видна только на мобильных (`md:hidden`), появляется после героя,
   отступ снизу `pb-[max(10px,env(safe-area-inset-bottom))]` под «домашнюю полоску» iPhone.
2. **Сетки схлопываются, а не масштабируются**: `grid md:grid-cols-2`, `md:grid-cols-3`,
   `grid-cols-[repeat(auto-fit,minmax(280px,1fr))]` для отзывов.
3. **Типографика на `clamp()`** — брейкпоинты для размера шрифта не нужны вовсе.

Точечные правки — через `max-sm:` / `max-md:` варианты, а не через отдельные блоки CSS.

---

## 10. Деплой

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

  location / { try_files $uri $uri/ /index.html; }

  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

Astro хэширует имена ассетов, поэтому `immutable` на год безопасен.

---

## 11. Чек-лист приёмки

**Токены**
- [ ] Ни одного хекса вне `@theme` (кроме `rgba()` в декоративных градиентах)
- [ ] Ровно один акцентный цвет несёт все CTA
- [ ] Фоны секций чередуются, три одинаковых подряд не встречаются

**Анимации**
- [ ] Весь GSAP — в одном `<script>` в `Layout.astro`
- [ ] Каждому `gsap.to()` предшествует `gsap.set()` со стартовым состоянием
- [ ] У всех reveal стоит `once: true`
- [ ] Ни одной анимации `width` / `height` / `top` / `left`
- [ ] Ни одного `transition: all`
- [ ] `prefers-reduced-motion` обработан и в CSS, и в JS
- [ ] `.cta-pulse` анимирует `opacity` псевдоэлемента, а не `box-shadow`
- [ ] Marquee ставится на паузу по hover
- [ ] SVG-пути имеют `stroke-dasharray` в CSS (защита от вспышки до инициализации JS)

**Разметка**
- [ ] `index.astro` содержит только импорты и порядок секций
- [ ] Все изображения проходят через `<Image />` из `astro:assets`
- [ ] Декоративные картинки: `alt=""` + `pointer-events-none`
- [ ] Первый экран: `loading="eager"`
- [ ] `viewport-fit=cover` в meta viewport

**Сборка**
- [ ] `npm run build` проходит без предупреждений
- [ ] `npm run preview` — визуальная проверка на 375px и 1440px
- [ ] Проверить каждую анимацию на 0.1x скорости в DevTools
