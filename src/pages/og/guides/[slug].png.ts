import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { createElement } from 'react';
import { ImageResponse } from 'takumi-js/response';
import { GuideOgImage } from '@/components/og/GuideOgImage';
import { ogImageOptions } from '@/lib/og-options';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const guides = await getCollection('guides');
  return guides.map((guide) => ({
    params: { slug: guide.id },
    props: { guide },
  }));
};

export const GET: APIRoute = ({ props }) => {
  const { guide } = props as { guide: CollectionEntry<'guides'> };
  return new ImageResponse(createElement(GuideOgImage, { guide }), ogImageOptions);
};
