import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

const site = process.env.PUBLIC_SITE_URL;

export default defineConfig({
  site,
  // The Astro dev toolbar injects its own <h1>/<svg>/focusable controls into an
  // open shadow root, which Playwright pierces — polluting semantic QA assertions
  // (h1 count, decorative-svg audit, keyboard traversal). It is a dev-only overlay
  // absent from the production build, so disabling it makes QA measure the shipped
  // product. See tests/accessibility.spec.ts and tests/composition.spec.ts.
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwind()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
});