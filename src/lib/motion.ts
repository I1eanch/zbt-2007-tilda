import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const selector = [
  '[data-animate="reveal"]',
  '[data-animate="slide-left"]',
  '[data-animate="slide-right"]',
  '[data-animate="scale"]',
].join(',');

const COUNT_NUMERIC = /\d[\d \u00a0\u202f]*\d|\d/;

function parseCountStat(
  text: string,
): { prefix: string; suffix: string; sep: string; value: number } | null {
  const match = text.match(COUNT_NUMERIC);
  if (!match || match.index === undefined) return null;
  const raw = match[0];
  const prefix = text.slice(0, match.index);
  const suffix = text.slice(match.index + raw.length);
  const sep = (raw.match(/[ \u00a0\u202f]/) ?? [''])[0];
  const value = Number.parseInt(raw.replace(/[ \u00a0\u202f]/g, ''), 10);
  return { prefix, suffix, sep, value };
}

function groupThousands(value: number, sep: string): string {
  const digits = String(value);
  return sep ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : digits;
}

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

    for (const counter of gsap.utils.toArray<HTMLElement>('[data-count-up]')) {
      const parsed = parseCountStat(counter.textContent ?? '');
      if (!parsed) continue;
      const { prefix, suffix, sep, value } = parsed;
      const render = (n: number) => {
        counter.textContent = `${prefix}${groupThousands(n, sep)}${suffix}`;
      };
      const state = { current: 0 };
      render(0);
      gsap.to(state, {
        current: value,
        duration: 1.4,
        ease: 'power2.out',
        scrollTrigger: { trigger: counter, start: 'top 85%', once: true },
        onUpdate: () => render(Math.round(state.current)),
        onComplete: () => render(value),
      });
    }

    for (const container of gsap.utils.toArray<HTMLElement>('[data-animate="stagger"]')) {
      const items = gsap.utils.toArray<HTMLElement>(container.children);
      if (items.length === 0) continue;
      gsap.set(items, { opacity: 0, y: 24 });
      gsap.to(items, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.1,
        scrollTrigger: { trigger: container, start: 'top 85%', once: true },
      });
    }

    const nav = document.querySelector<HTMLElement>('[data-nav]');
    if (nav) {
      gsap.from(nav, { yPercent: -100, opacity: 0, duration: 0.6, ease: 'power3.out' });
    }
  });

  return () => context.revert();
}
