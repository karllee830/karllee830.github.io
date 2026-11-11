// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { figureCaptions } from './src/lib/markdown/figures.mjs';
import { codeBlocks } from './src/lib/markdown/code-blocks.mjs';

// GitHub Actions passes these in (see .github/workflows/deploy.yml).
// For a user site (<name>.github.io) BASE_PATH is empty.
const site = process.env.SITE_URL || 'https://www.leekarl.com';
const base = process.env.BASE_PATH || '/';

/** @param {string} file */
const fontFile = (file) => `./node_modules/@fontsource-variable/${file}`;

export default defineConfig({
  site,
  base,
  integrations: [react(), sitemap()],
  prefetch: { defaultStrategy: 'hover' },
  // Google Sans Flex + Google Sans Code (SIL Open Font License), self-hosted.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Google Sans Flex',
      cssVariable: '--font-display',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          {
            weight: '1 1000',
            style: 'normal',
            src: [fontFile('google-sans-flex/files/google-sans-flex-latin-wght-normal.woff2')],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Google Sans Code',
      cssVariable: '--font-code',
      fallbacks: ['monospace'],
      options: {
        variants: [
          {
            weight: '300 800',
            style: 'normal',
            src: [fontFile('google-sans-code/files/google-sans-code-latin-wght-normal.woff2')],
          },
        ],
      },
    },
  ],
  markdown: {
    shikiConfig: { theme: 'css-variables' },
    processor: satteri({ hastPlugins: [figureCaptions, codeBlocks] }),
  },
});
