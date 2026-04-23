import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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

const lessons = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/lessons' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    category: z.enum([
      'foundations',
      'scalability',
      'data-storage',
      'real-time',
      'reliability',
      'security',
      'cloud-infra',
      'observability',
      'ai-ml',
      'architecture-techniques',
    ]),
    level: z.enum(['foundational', 'intermediate', 'advanced']),
    timeMinutes: z.number(),
    tags: z.array(z.string()),
    relatedGuides: z.array(z.string()).default([]),
    relatedSystems: z.array(z.string()).default([]),
    prerequisites: z.array(z.string()).default([]),
  }),
});

export const collections = { systems, guides, lessons };
