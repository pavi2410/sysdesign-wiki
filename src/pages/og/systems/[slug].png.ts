import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { createElement } from 'react';
import { ImageResponse } from 'takumi-js/response';
import { SystemOgImage } from '@/components/og/SystemOgImage';
import { ogImageOptions } from '@/lib/og-options';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const systems = await getCollection('systems');
  return systems.map((system) => ({
    params: { slug: system.id },
    props: { system },
  }));
};

export const GET: APIRoute = ({ props }) => {
  const { system } = props as { system: CollectionEntry<'systems'> };
  return new ImageResponse(createElement(SystemOgImage, { system }), ogImageOptions);
};
