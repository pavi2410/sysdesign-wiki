import type { APIRoute } from 'astro';
import { createElement } from 'react';
import { ImageResponse } from 'takumi-js/response';
import { DefaultOgImage } from '@/components/og/DefaultOgImage';
import { ogImageOptions } from '@/lib/og-options';

export const prerender = true;

export const GET: APIRoute = () => {
  return new ImageResponse(createElement(DefaultOgImage), ogImageOptions);
};
