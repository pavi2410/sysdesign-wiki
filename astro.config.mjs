// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://sysdesign.wiki',
  trailingSlash: 'ignore',
  integrations: [sitemap(), pagefind(), mdx()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});