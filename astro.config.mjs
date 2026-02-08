// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://sysdesign.wiki',
  integrations: [sitemap()],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ['@resvg/resvg-js'],
    },
    build: {
      rollupOptions: {
        external: ['@resvg/resvg-js'],
      },
    },
    optimizeDeps: {
      exclude: ['@resvg/resvg-js'],
    },
  },

  adapter: cloudflare(),
});