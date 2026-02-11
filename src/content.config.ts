import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const systems = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/systems' }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    category: z.enum(['messaging', 'social', 'streaming', 'transport', 'search', 'commerce', 'infra', 'video', 'devtools', 'ai', 'productivity']),
    tags: z.array(z.string()),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    category: z.enum(['real-time', 'platform', 'data', 'reliability', 'security', 'media', 'collaboration']),
    tags: z.array(z.string()),
  }),
});

export const collections = { systems, guides };
