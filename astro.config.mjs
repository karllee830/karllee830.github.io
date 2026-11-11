// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// GitHub Actions passes these in (see .github/workflows/deploy.yml).
// For a user site (<name>.github.io) BASE_PATH is empty.
const site = process.env.SITE_URL || 'https://karllee830.github.io';
const base = process.env.BASE_PATH || '/';

/** @param {string} file */
const geist = (file) => `./node_modules/@fontsource-variable/${file}`;

export default defineConfig({
  site,
  base,
  integrations: [react(), sitemap()],
  prefetch: { defaultStrategy: 'hover' },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Geist',
      cssVariable: '--font-geist',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          { weight: '100 900', style: 'normal', src: [geist('geist/files/geist-latin-wght-normal.woff2')] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Geist Mono',
      cssVariable: '--font-geist-mono',
      fallbacks: ['monospace'],
      options: {
        variants: [
          { weight: '100 900', style: 'normal', src: [geist('geist-mono/files/geist-mono-latin-wght-normal.woff2')] },
        ],
      },
    },
  ],
  markdown: {
    shikiConfig: { theme: 'css-variables' },
  },
});
